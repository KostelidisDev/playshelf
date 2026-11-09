/* The catalog editor (served at /studio/): opens Games.txt and Videos.txt,
 * adds, changes or removes games and videos, and exports the files again.
 * The files are read and written in this page only; nothing is sent to a
 * server. Both files are needed to edit: a video is on games, so the games
 * have to be there to choose from. */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CatalogFormatError,
  GAMES_FILE,
  VIDEOS_FILE,
  coverUrl,
  linkVideos,
  parseDate,
  readGames,
  readVideos,
  toGamesFile,
  toVideosFile,
  videoImages,
  type GameRecord,
  type SkippedRow,
  type VideoRecord,
} from "../lib/catalog.ts";
import { paginate } from "../lib/pagination.ts";
import {
  checkGameTitle,
  checkVideo,
  newGameId,
  newestVideoByGame,
  putGame,
  putVideo,
  removeGame,
  removeVideo,
  studioPicture,
  videosOfGame,
  type FieldErrors,
  type VideoDraft,
  type VideoField,
} from "../lib/studio.ts";
import { normalizeText, plural } from "../lib/text.ts";
import { browserDraftStore, type Draft, type DraftStore } from "./draftStore.ts";
import { GameForm } from "./GameForm.tsx";
import { RecordCard } from "./RecordCard.tsx";
import { VideoForm } from "./VideoForm.tsx";

/** One of the two files, as it is in the editor. `dirty` is set once it has
 * changed since it was opened or last exported. */
interface Slot<T> {
  readonly records: readonly T[];
  readonly dirty: boolean;
}

type Tab = "games" | "videos";

/** Rows drawn at once in a list. */
const PAGE_SIZE = 50;
/** The largest file that can be a catalog file; anything bigger is the wrong file. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const NO_RECORDS: readonly never[] = [];
/** The "form is open for a new row" marker. Ids can't contain "+", so it
 * can't be a game's or a video's id. */
const NEW = "+new";
const defaultDrafts = browserDraftStore();

/** `drafts` is where the saved copy is kept; the page's own is the default. */
export function StudioApp({ drafts = defaultDrafts }: { drafts?: DraftStore } = {}) {
  const [games, setGames] = useState<Slot<GameRecord> | null>(null);
  const [videos, setVideos] = useState<Slot<VideoRecord> | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  /** Whether this browser holds a copy of the files as they are now. */
  const [cached, setCached] = useState(false);
  /** Set once the user opens or starts a catalog, so a late restore doesn't replace it. */
  const touched = useRef(false);
  const [tab, setTab] = useState<Tab>("games");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  /** The id of the row whose form is open, or NEW. Only the current tab's rows. */
  const [editing, setEditing] = useState<string | null>(null);

  const ready = games !== null && videos !== null;
  const dirty = (games?.dirty ?? false) || (videos?.dirty ?? false);

  // Restores the saved copy, if there is one and nothing has been opened yet.
  useEffect(() => {
    let cancelled = false;
    void drafts.load().then((draft) => {
      if (cancelled || draft === null || touched.current) return;
      try {
        const restoredGames = draft.games === null ? null : readGames(draft.games, GAMES_FILE);
        const restoredVideos = draft.videos === null ? null : readVideos(draft.videos, VIDEOS_FILE);
        if (restoredGames) setGames({ records: restoredGames.records, dirty: draft.gamesDirty });
        if (restoredVideos) setVideos({ records: restoredVideos.records, dirty: draft.videosDirty });
        if (restoredGames || restoredVideos) {
          setCached(true);
          setNotice("Restored your last edits from this browser.");
        }
      } catch {
        setNotice("The saved copy in this browser couldn't be read, so it wasn't loaded.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [drafts]);

  // Every change is kept in this browser, so a page closed by mistake loses nothing.
  useEffect(() => {
    if (!drafts.available || (games === null && videos === null)) return;
    const draft: Draft = {
      games: games ? toGamesFile(games.records) : null,
      videos: videos ? toVideosFile(videos.records) : null,
      gamesDirty: games?.dirty ?? false,
      videosDirty: videos?.dirty ?? false,
    };
    let cancelled = false;
    void drafts.save(draft).then((ok) => {
      if (cancelled) return;
      setCached(ok);
      if (!ok) setNotice("This browser won't keep a copy of the catalog. Export the files to keep your changes.");
    });
    return () => {
      cancelled = true;
    };
  }, [games, videos, drafts]);

  async function forgetCopy() {
    if (!window.confirm("Forget the saved copy in this browser? Changes you haven't exported are lost.")) return;
    if (!(await drafts.clear())) {
      setNotice("The saved copy couldn't be removed from this browser.");
      return;
    }
    touched.current = true;
    setCached(false);
    setGames(null);
    setVideos(null);
    setNotes([]);
    setTab("games");
    resetView();
  }

  // Leaving the page with changes not yet exported would lose them.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const gameList = games?.records ?? NO_RECORDS;
  const videoList = videos?.records ?? NO_RECORDS;

  const newestVideos = useMemo(() => newestVideoByGame(videoList), [videoList]);

  const gameTitles = useMemo(() => new Map(gameList.map((game) => [game.id, game.title])), [gameList]);
  const videoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const video of videoList) for (const id of video.gameIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, [videoList]);

  const gameMatches = useMemo(() => {
    const sorted = [...gameList].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    const needle = normalizeText(query.trim());
    return needle ? sorted.filter((game) => normalizeText(`${game.id} ${game.title}`).includes(needle)) : sorted;
  }, [gameList, query]);

  const videoMatches = useMemo(() => {
    const newest = [...videoList].sort((a, b) => (parseDate(b.publishedAt)?.getTime() ?? 0) - (parseDate(a.publishedAt)?.getTime() ?? 0));
    const needle = normalizeText(query.trim());
    if (!needle) return newest;
    return newest.filter((video) => {
      const names = video.gameIds.map((id) => gameTitles.get(id) ?? "").join(" ");
      return normalizeText(`${video.id} ${video.title} ${names}`).includes(needle);
    });
  }, [videoList, query, gameTitles]);

  const matches = tab === "games" ? gameMatches : videoMatches;
  const shown = paginate(matches, page, PAGE_SIZE);

  /** Opening a file, or starting a new catalog, replaces what's on screen,
   * so unexported changes get a chance to be kept first. */
  const mayReplace = (slot: Slot<unknown> | null) => !slot?.dirty || window.confirm("Discard the changes you haven't exported?");

  function resetView() {
    setEditing(null);
    setQuery("");
    setPage(1);
    setNotice(null);
  }

  function switchTab(next: Tab) {
    setTab(next);
    resetView();
  }

  async function openFile(kind: Tab, file: File) {
    if (!mayReplace(kind === "games" ? games : videos)) return;
    if (file.size > MAX_FILE_BYTES) {
      setNotice(`${file.name} is too large to be a catalog file (over ${MAX_FILE_BYTES / 1024 / 1024} MB).`);
      return;
    }
    try {
      const text = await file.text();
      touched.current = true;
      if (kind === "games") {
        const read = readGames(text, file.name);
        // A games file that replaces the old one may leave videos without a game.
        const link = videos ? linkVideos(videos.records, read.records) : null;
        setGames({ records: read.records, dirty: false });
        if (videos && link) setVideos({ records: link.videos, dirty: videos.dirty || link.skipped.length > 0 });
        setNotes(describe([...read.skipped, ...(link?.skipped ?? [])]));
      } else {
        const read = readVideos(text, file.name);
        // Videos can be opened before the games; they're linked when the games arrive.
        const link = games ? linkVideos(read.records, games.records) : null;
        setVideos({ records: link ? link.videos : read.records, dirty: false });
        setNotes(describe([...read.skipped, ...(link?.skipped ?? [])]));
      }
      resetView();
    } catch (error) {
      setNotice(error instanceof CatalogFormatError ? error.message : `Couldn't read ${file.name}.`);
    }
  }

  function onFileChosen(kind: Tab) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Clear the input, so choosing the same file again still fires a change.
      event.target.value = "";
      if (file) void openFile(kind, file);
    };
  }

  function startNew() {
    if (!mayReplace(games) || !mayReplace(videos)) return;
    touched.current = true;
    // A new catalog counts as unsaved: it isn't on disk yet.
    setGames({ records: [], dirty: true });
    setVideos({ records: [], dirty: true });
    setNotes([]);
    setTab("games");
    resetView();
  }

  // ---------- Games ----------

  /** Saves a game: a new one gets its id from its title. Returns the error to show, or null once saved. */
  function saveGame(title: string, replacing: string | null): string | null {
    if (!games) return null;
    const checked = checkGameTitle(title);
    if (!checked.ok) return checked.error;
    const id = replacing ?? newGameId(checked.title, new Set(games.records.map((game) => game.id)));
    const put = putGame(games.records, { id, title: checked.title }, replacing);
    if (!put.ok) return put.error;
    setGames({ records: put.games, dirty: true });
    setEditing(null);
    return null;
  }

  function deleteGame(game: GameRecord) {
    if (!games || !videos) return;
    const affected = videosOfGame(videos.records, game.id);
    const orphaned = affected.filter((video) => video.gameIds.length === 1).length;
    let message = `Delete “${game.title}”?`;
    if (affected.length > 0) {
      message += ` ${plural(affected.length, "video")} ${affected.length === 1 ? "is" : "are"} on it.`;
      message += orphaned > 0
        ? ` ${plural(orphaned, "video")} with no other game ${orphaned === 1 ? "is" : "are"} deleted too.`
        : " They stay, without this game.";
    }
    if (!window.confirm(message)) return;
    const next = removeGame(games.records, videos.records, game.id);
    setGames({ records: next.games, dirty: true });
    setVideos({ records: next.videos, dirty: true });
    if (next.removedVideos.length > 0) {
      setNotes(next.removedVideos.map((video) => `Deleted with “${game.title}”: ${video.title}`));
    }
    if (editing === game.id) setEditing(null);
  }

  // ---------- Videos ----------

  function saveVideo(draft: VideoDraft, replacing: string | null): FieldErrors<VideoField> | null {
    if (!games || !videos) return null;
    const checked = checkVideo(draft, games.records);
    if (!checked.ok) return checked.errors;
    const put = putVideo(videos.records, checked.record, replacing);
    if (!put.ok) return put.errors;
    setVideos({ records: put.videos, dirty: true });
    setEditing(null);
    return null;
  }

  function deleteVideo(video: VideoRecord) {
    if (!videos) return;
    if (!window.confirm(`Delete “${video.title}” from the catalog?`)) return;
    setVideos({ records: removeVideo(videos.records, video.id), dirty: true });
    if (editing === video.id) setEditing(null);
  }

  // ---------- Export ----------

  function exportFile(kind: Tab) {
    if (kind === "games" && games) {
      download(GAMES_FILE, toGamesFile(games.records));
      setGames({ records: games.records, dirty: false });
    } else if (kind === "videos" && videos) {
      download(VIDEOS_FILE, toVideosFile(videos.records));
      setVideos({ records: videos.records, dirty: false });
    }
  }

  // ---------- Render ----------

  const summary = [
    games && `${GAMES_FILE} · ${plural(gameList.length, "game")}`,
    videos && `${VIDEOS_FILE} · ${plural(videoList.length, "video")}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="studio">
      <header className="studio-bar">
        <div className="studio-title">
          <h1>Catalog editor</h1>
          <p className="studio-status" role="status">
            {summary}
            {dirty && <span className="studio-dirty"> · unsaved changes</span>}
            {cached && <span> · copy kept in this browser</span>}
          </p>
        </div>
        {(games || videos) && (
          <div className="studio-actions">
            {ready && <OpenButton label={`Open ${GAMES_FILE}`} onFile={onFileChosen("games")} />}
            {ready && <OpenButton label={`Open ${VIDEOS_FILE}`} onFile={onFileChosen("videos")} />}
            {games && <button className="btn" type="button" onClick={() => exportFile("games")}>Export {GAMES_FILE}</button>}
            {videos && <button className="btn" type="button" onClick={() => exportFile("videos")}>Export {VIDEOS_FILE}</button>}
          </div>
        )}
      </header>

      <main className="studio-main">
        {notice && <p className="studio-notice" role="alert">{notice}</p>}

        {cached && (
          <div className="studio-notice studio-cache">
            <p>
              Your edits are kept in this browser, but only temporarily: the browser can delete them at any time.
              Export both files to keep them.
            </p>
            <button className="btn btn-secondary btn-small" type="button" onClick={forgetCopy}>Forget saved copy</button>
          </div>
        )}

        {notes.length > 0 && (
          <details className="studio-notice studio-skipped">
            <summary>{plural(notes.length, "row")} left out when the files were opened</summary>
            <p>Rows left out aren't in the editor, so the export leaves them out too. Fix them in the original files if they matter.</p>
            <ul>
              {notes.map((note, index) => <li key={index}>{note}</li>)}
            </ul>
          </details>
        )}

        {ready ? (
          <>
            <div className="studio-tabs" role="tablist" aria-label="Catalog">
              <button
                id="tab-games"
                type="button"
                role="tab"
                aria-selected={tab === "games"}
                aria-controls="studio-panel"
                className={tab === "games" ? "studio-tab studio-tab-active" : "studio-tab"}
                onClick={() => switchTab("games")}
              >
                Games <span className="studio-count">{gameList.length}</span>
              </button>
              <button
                id="tab-videos"
                type="button"
                role="tab"
                aria-selected={tab === "videos"}
                aria-controls="studio-panel"
                className={tab === "videos" ? "studio-tab studio-tab-active" : "studio-tab"}
                onClick={() => switchTab("videos")}
              >
                Videos <span className="studio-count">{videoList.length}</span>
              </button>
            </div>

            <section id="studio-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} aria-label={tab === "games" ? "Games" : "Videos"}>
              <div className="studio-toolbar">
                <div className="studio-search field">
                  <label htmlFor="studio-search" className="field-label">Search</label>
                  <input
                    id="studio-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder={tab === "games" ? "Title or game ID" : "Title, game or video ID"}
                    autoComplete="off"
                  />
                </div>
                <button className="btn" type="button" disabled={editing !== null} onClick={() => setEditing(NEW)}>
                  {tab === "games" ? "Add game" : "Add video"}
                </button>
              </div>

              {editing === NEW && tab === "games" && (
                <GameForm initialTitle="" id={null} onSave={(title) => saveGame(title, null)} onCancel={() => setEditing(null)} />
              )}
              {editing === NEW && tab === "videos" && games && (
                <VideoForm
                  initial={{ id: "", title: "", publishedAt: "", gameIds: [] }}
                  games={gameList}
                  onSave={(draft) => saveVideo(draft, null)}
                  onCancel={() => setEditing(null)}
                />
              )}

              {shown.items.length === 0 ? (
                <p className="studio-empty">
                  {tab === "games"
                    ? (gameList.length === 0 ? "No games yet. Add one, or export the empty file." : "No games match the search.")
                    : (videoList.length === 0 ? "No videos yet. Add one, or export the empty file." : "No videos match the search.")}
                </p>
              ) : (
                <>
                  <Pager page={shown.page} pages={shown.pages} onPage={setPage} />
                  <ul className="studio-grid">
                    {tab === "games"
                      ? (shown.items as GameRecord[]).map((game) => (
                        editing === game.id ? (
                          <li key={game.id} className="studio-edit">
                            <GameForm
                              initialTitle={game.title}
                              id={game.id}
                              onSave={(title) => saveGame(title, game.id)}
                              onCancel={() => setEditing(null)}
                            />
                          </li>
                        ) : (
                          <RecordCard
                            key={game.id}
                            variant="game"
                            title={game.title}
                            images={gameImages(game, newestVideos.get(game.id))}
                            meta={
                              <>
                                <span>{plural(videoCounts.get(game.id) ?? 0, "video")}</span>
                                <span>{game.id}</span>
                              </>
                            }
                          >
                            <RowButtons label={game.title} disabled={editing !== null} onEdit={() => setEditing(game.id)} onDelete={() => deleteGame(game)} />
                          </RecordCard>
                        )
                      ))
                      : (shown.items as VideoRecord[]).map((video) => (
                        editing === video.id && games ? (
                          <li key={video.id} className="studio-edit">
                            <VideoForm
                              initial={{ id: video.id, title: video.title, publishedAt: video.publishedAt, gameIds: video.gameIds }}
                              games={gameList}
                              onSave={(draft) => saveVideo(draft, video.id)}
                              onCancel={() => setEditing(null)}
                            />
                          </li>
                        ) : (
                          <RecordCard
                            key={video.id}
                            variant="video"
                            title={video.title}
                            images={studioPictures(videoImages(video))}
                            meta={
                              <>
                                <time dateTime={video.publishedAt}>{video.publishedAt}</time>
                                <span>{video.gameIds.map((id) => gameTitles.get(id) ?? id).join(", ") || "No game"}</span>
                                <span>{video.id}</span>
                              </>
                            }
                          >
                            <RowButtons label={video.title} disabled={editing !== null} onEdit={() => setEditing(video.id)} onDelete={() => deleteVideo(video)} />
                          </RecordCard>
                        )
                      ))}
                  </ul>
                </>
              )}
            </section>
          </>
        ) : (
          <div className="welcome">
            <h2>Edit the catalog</h2>
            <p>
              The site reads two files: <strong>{GAMES_FILE}</strong>, the games, and <strong>{VIDEOS_FILE}</strong>, the
              videos and the games each one is on. Open both to edit them, or start a new catalog.
            </p>
            <p>
              Nothing is uploaded. The files stay in this page until you export them
              {drafts.available && ", and a temporary copy is kept in this browser"}.
            </p>
            <div className="studio-actions">
              <OpenButton label={`Open ${GAMES_FILE}`} primary={!games} onFile={onFileChosen("games")} />
              <OpenButton label={`Open ${VIDEOS_FILE}`} primary={!!games && !videos} onFile={onFileChosen("videos")} />
              <button className="btn btn-secondary" type="button" onClick={startNew}>Start a new catalog</button>
            </div>
            {games && !videos && <p className="field-hint">{GAMES_FILE} is open. Open {VIDEOS_FILE} to continue.</p>}
            {videos && !games && <p className="field-hint">{VIDEOS_FILE} is open. Open {GAMES_FILE} to continue.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

/** Saves a file to the user's computer. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a moment later, so the download has started first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A game's pictures: its cover, then its newest video's, as on the site. */
function gameImages(game: GameRecord, newest: VideoRecord | undefined): string[] {
  return studioPictures([coverUrl(game), ...(newest ? videoImages(newest) : [])]);
}

function studioPictures(urls: readonly string[]): string[] {
  return urls.map(studioPicture);
}

/** The skipped rows as lines for the notice. */
function describe(skipped: readonly SkippedRow[]): string[] {
  return skipped.map((skip) => `${skip.file}${skip.row === null ? "" : ` row ${skip.row}`}: ${skip.reason}`);
}

function RowButtons({ label, disabled, onEdit, onDelete }: { label: string; disabled: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="studio-actions">
      <button className="btn btn-secondary btn-small" type="button" disabled={disabled} aria-label={`Edit ${label}`} onClick={onEdit}>
        Edit
      </button>
      <button className="btn btn-secondary btn-small" type="button" disabled={disabled} aria-label={`Delete ${label}`} onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="studio-pager" aria-label="Pages">
      <button className="btn btn-secondary btn-small" type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-secondary btn-small" type="button" disabled={page === pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/** A file picker styled as a button. The input is visually hidden but still
 * reachable from the keyboard, and the label says what it does. */
function OpenButton({ label, primary, onFile }: { label: string; primary?: boolean | undefined; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className={primary ? "btn file-button" : "btn btn-secondary file-button"}>
      <input type="file" accept=".txt,.csv,text/plain,text/csv" className="visually-hidden" onChange={onFile} />
      {label}
    </label>
  );
}

/* The catalog editor (served at /studio/): open a videos.csv, add, change
 * or remove its videos, and export it again. The file is read and written
 * in this page only; nothing is sent to a server. */

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  CATALOG_FILE_NAME,
  CatalogFormatError,
  MAX_CATALOG_BYTES,
  checkRecord,
  gameKey,
  gameTitles,
  putRecord,
  readCatalog,
  removeRecord,
  sortNewestFirst,
  toCatalogCsv,
  type Draft,
  type FieldErrors,
  type SkippedRow,
  type VideoRecord,
} from "../lib/studio.ts";
import { normalizeText, plural } from "../lib/text.ts";
import { RecordForm } from "./RecordForm.tsx";

/** One catalog open in the editor. */
interface Session {
  readonly fileName: string;
  readonly records: readonly VideoRecord[];
  readonly skipped: readonly SkippedRow[];
  /** Changed since it was opened or last exported. */
  readonly dirty: boolean;
}

/** Which row has its form open: a video's id, NEW for a new video, or null.
 * Video ids are 11 characters, so NEW can't clash with one. */
const NEW = "new";
type Editing = string | typeof NEW | null;

const EMPTY_DRAFT: Draft = { id: "", title: "", publishedAt: "", gameTitle: "" };
const NO_RECORDS: readonly VideoRecord[] = [];
/** Rows drawn at once in the list. */
const PAGE_SIZE = 50;

export function StudioApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);

  const dirty = session?.dirty ?? false;
  const records = session?.records ?? NO_RECORDS;

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

  // Only one page of rows is drawn at a time: a catalog of thousands of
  // videos would otherwise mean thousands of rows re-rendered on every key.
  const matches = useMemo(() => {
    const sorted = sortNewestFirst(records);
    const needle = normalizeText(query.trim());
    if (!needle) return sorted;
    return sorted.filter((record) => normalizeText(`${record.id} ${record.title} ${record.gameTitle}`).includes(needle));
  }, [records, query]);

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  // Clamped, so a page that no longer exists (after deletes or a new search) shows the last one.
  const current = Math.min(page, pageCount);
  const visible = useMemo(
    () => matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [matches, current],
  );

  const gameCount = useMemo(
    () => new Set(records.filter((record) => record.gameTitle !== "").map((record) => gameKey(record.gameTitle))).size,
    [records],
  );
  const suggestions = useMemo(() => gameTitles(records), [records]);

  /** Opening a file or starting a new one replaces the catalog on screen,
   * so unsaved changes get a chance to be kept first. */
  const mayReplace = () => !dirty || window.confirm("Discard the changes you haven't exported?");

  function show(next: Session) {
    setSession(next);
    setEditing(null);
    setQuery("");
    setNotice(null);
  }

  async function openFile(file: File) {
    if (!mayReplace()) return;
    if (file.size > MAX_CATALOG_BYTES) {
      setNotice(`${file.name} is too large to be a catalog (over ${MAX_CATALOG_BYTES / 1024 / 1024} MB).`);
      return;
    }
    try {
      const loaded = readCatalog(await file.text(), file.name);
      show({ fileName: file.name, records: loaded.records, skipped: loaded.skipped, dirty: false });
    } catch (error) {
      setNotice(error instanceof CatalogFormatError ? error.message : `Couldn't read ${file.name}.`);
    }
  }

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input, so choosing the same file again still fires a change.
    event.target.value = "";
    if (file) void openFile(file);
  }

  function startNew() {
    if (!mayReplace()) return;
    // A new catalog counts as unsaved: it isn't a file yet.
    show({ fileName: CATALOG_FILE_NAME, records: [], skipped: [], dirty: true });
  }

  /** Checks a row and, when it's valid, puts it in the catalog. Returns the
   * field errors to show, or null once saved. */
  function save(draft: Draft, replacing: string | null): FieldErrors | null {
    if (!session) return null;
    const checked = checkRecord(draft);
    if (!checked.ok) return checked.errors;
    const put = putRecord(session.records, checked.record, replacing);
    if (!put.ok) return put.errors;
    setSession({ ...session, records: put.records, dirty: true });
    setEditing(null);
    return null;
  }

  function remove(record: VideoRecord) {
    if (!session) return;
    if (!window.confirm(`Delete “${record.title}” from the catalog?`)) return;
    setSession({ ...session, records: removeRecord(session.records, record.id), dirty: true });
    if (editing === record.id) setEditing(null);
  }

  function startAdding() {
    setQuery("");
    setEditing(NEW);
  }

  function exportFile() {
    if (!session) return;
    const blob = new Blob([toCatalogCsv(session.records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = CATALOG_FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoked a moment later, so the download has started first.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSession({ ...session, dirty: false });
  }

  const status = session
    ? `${session.fileName} · ${plural(records.length, "video")} in ${plural(gameCount, "game")}`
    : "";

  return (
    <div className="studio">
      <header className="studio-bar">
        <div className="studio-title">
          <h1>Catalog editor</h1>
          <p className="studio-status" role="status">
            {status}
            {dirty && <span className="studio-dirty"> · unsaved changes</span>}
          </p>
        </div>
        {session && (
          <div className="studio-actions">
            <OpenButton label="Open another file" onFile={onFileChosen} />
            <button className="btn" type="button" onClick={exportFile}>Export {CATALOG_FILE_NAME}</button>
          </div>
        )}
      </header>

      <main className="studio-main">
        {notice && <p className="studio-notice" role="alert">{notice}</p>}

        {session ? (
          <section aria-label="Videos">
            {session.skipped.length > 0 && (
              <details className="studio-notice studio-skipped">
                <summary>{plural(session.skipped.length, "row")} skipped when the file was opened</summary>
                <p>Skipped rows aren't in the editor, so the export leaves them out. Fix them in the original file if they matter.</p>
                <ul>
                  {session.skipped.map((skip) => (
                    <li key={skip.row}>Row {skip.row}: {skip.reason}</li>
                  ))}
                </ul>
              </details>
            )}

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
                  placeholder="Title, game or video ID"
                  autoComplete="off"
                />
              </div>
              <button className="btn" type="button" disabled={editing !== null} onClick={startAdding}>Add video</button>
            </div>

            {editing === NEW && (
              <RecordForm
                initial={EMPTY_DRAFT}
                suggestions={suggestions}
                onSave={(draft) => save(draft, null)}
                onCancel={() => setEditing(null)}
              />
            )}

            {visible.length === 0 ? (
              <p className="studio-empty">
                {records.length === 0 ? "No videos yet. Add one, or export the empty catalog." : "No videos match the search."}
              </p>
            ) : (
              <>
                {pageCount > 1 && (
                  <nav className="studio-pager" aria-label="Pages of videos">
                    <button className="btn btn-secondary btn-small" type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>
                      Previous
                    </button>
                    <span>Page {current} of {pageCount}</span>
                    <button className="btn btn-secondary btn-small" type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)}>
                      Next
                    </button>
                  </nav>
                )}
              <ul className="records">
                {visible.map((record) => (
                  <li key={record.id} className={editing === record.id ? undefined : "record"}>
                    {editing === record.id ? (
                      <RecordForm
                        initial={{ id: record.id, title: record.title, publishedAt: record.publishedAt, gameTitle: record.gameTitle }}
                        suggestions={suggestions}
                        onSave={(draft) => save(draft, record.id)}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <>
                        <div className="record-info">
                          <p className="record-title">{record.title}</p>
                          <p className="record-meta">
                            <time dateTime={record.publishedAt}>{record.publishedAt}</time>
                            <span>{record.gameTitle || "No game"}</span>
                            <span>{record.id}</span>
                          </p>
                        </div>
                        <div className="studio-actions">
                          <button
                            className="btn btn-secondary btn-small"
                            type="button"
                            disabled={editing !== null}
                            aria-label={`Edit ${record.title}`}
                            onClick={() => setEditing(record.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-secondary btn-small"
                            type="button"
                            disabled={editing !== null}
                            aria-label={`Delete ${record.title}`}
                            onClick={() => remove(record)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              </>
            )}
          </section>
        ) : (
          <div className="welcome">
            <h2>Edit a catalog</h2>
            <p>
              Open the site&rsquo;s {CATALOG_FILE_NAME} to add, change or remove videos. When you&rsquo;re done,
              export the file and put it where the site reads its catalog.
            </p>
            <p>Nothing is uploaded. The file stays in this page until you export it.</p>
            <div className="studio-actions">
              <OpenButton label="Open a CSV file" primary onFile={onFileChosen} />
              <button className="btn btn-secondary" type="button" onClick={startNew}>Start a new catalog</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** A file picker styled as a button. The input is visually hidden but still
 * reachable from the keyboard, and the label says what it does. */
function OpenButton({ label, primary, onFile }: { label: string; primary?: boolean | undefined; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className={primary ? "btn file-button" : "btn btn-secondary file-button"}>
      <input type="file" accept=".csv,text/csv" className="visually-hidden" onChange={onFile} />
      {label}
    </label>
  );
}

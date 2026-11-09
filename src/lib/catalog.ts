/* The catalog, as the site and the studio read it. The owner keeps two files
 * in assets/api/ and replaces them to update the site:
 *
 *   Games.txt    game_id,title
 *   Videos.txt   video_id,title,published_at,game_ids
 *
 * A game is a title with a stable id, so a game can be renamed without
 * touching its videos. game_ids lists a video's games by id, separated by
 * ";", and a video needs at least one. A game may have no videos and is
 * still listed. The studio (lib/studio.ts) checks rows with these same
 * rules, so a file it writes loads here. */

import { parseCSVTable } from "./csv.ts";
import { cleanText, firstLetter, normalizeText } from "./text.ts";

export const GAMES_FILE = "Games.txt";
export const VIDEOS_FILE = "Videos.txt";
export const GAMES_URL = `assets/api/${GAMES_FILE}`;
export const VIDEOS_URL = `assets/api/${VIDEOS_FILE}`;
export const GAME_COLUMNS = ["game_id", "title"] as const;
export const VIDEO_COLUMNS = ["video_id", "title", "published_at", "game_ids"] as const;
/** Between the ids in a video's game_ids. Game ids can't contain it. */
export const GAME_ID_SEPARATOR = ";";
export const MAX_GAME_TITLE_LENGTH = 150;
export const MAX_VIDEO_TITLE_LENGTH = 200;
/** A game id goes into URLs and file names, so it's kept to plain characters. */
export const GAME_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** A YouTube id: 11 URL-safe characters. Every URL and file name built from
 * an id relies on this check, so a crafted row can't point a link or an
 * image anywhere else. preload_media.py makes the same check. */
export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface GameRecord {
  readonly id: string;
  readonly title: string;
}

/** `publishedAt` is the date as the file holds it (parseDate reads it), and
 * `gameIds` only the games that exist (see linkVideos). */
export interface VideoRecord {
  readonly id: string;
  readonly title: string;
  readonly publishedAt: string;
  readonly gameIds: readonly string[];
}

/** A row that was left out, or a game that was left off a video. `row` is
 * the 1-based data row, or null when the reason isn't about one row. */
export interface SkippedRow {
  readonly file: string;
  readonly row: number | null;
  readonly reason: string;
}

export interface ReadResult<T> {
  readonly records: T[];
  readonly skipped: SkippedRow[];
}

/** A file that isn't a catalog file: it's missing a column. Rows that are
 * merely invalid are skipped and reported, not thrown. */
export class CatalogFormatError extends Error {
  override name = "CatalogFormatError";
}

/** Text with control and bidi characters removed and whitespace collapsed,
 * but no length cap, so a length check can say what went wrong. */
function tidy(value: unknown): string {
  return cleanText(value, Number.POSITIVE_INFINITY);
}

function requireColumns(header: readonly string[], columns: readonly string[], file: string): void {
  const missing = columns.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new CatalogFormatError(`${file} is missing column(s): ${missing.join(", ")}.`);
}

/** Reads Games.txt. Rows with an invalid id or title, or a repeated id, are
 * skipped and listed. */
export function readGames(text: string, file: string = GAMES_FILE): ReadResult<GameRecord> {
  const { header, rows } = parseCSVTable(text);
  requireColumns(header, GAME_COLUMNS, file);

  const records: GameRecord[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const id = (row.game_id ?? "").trim();
    const title = tidy(row.title);
    let reason: string | null = null;
    if (!GAME_ID_PATTERN.test(id)) reason = "game_id must be 1 to 64 letters, digits, - or _";
    else if (!title) reason = "title is empty";
    else if (title.length > MAX_GAME_TITLE_LENGTH) reason = `title is too long (max ${MAX_GAME_TITLE_LENGTH} characters)`;
    else if (seen.has(id)) reason = `duplicate game_id ${id}`;

    if (reason) {
      skipped.push({ file, row: index + 1, reason });
    } else {
      seen.add(id);
      records.push({ id, title });
    }
  });
  return { records, skipped };
}

/** Reads Videos.txt. A missing title shows the id, and a date that isn't
 * one is kept as the file has it (the site then sorts it last). Rows with
 * an invalid or repeated video id, or no valid game id, are skipped. */
export function readVideos(text: string, file: string = VIDEOS_FILE): ReadResult<VideoRecord> {
  const { header, rows } = parseCSVTable(text);
  requireColumns(header, VIDEO_COLUMNS, file);

  const records: VideoRecord[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const number = index + 1;
    const id = (row.video_id ?? "").trim();
    const gameIds = splitGameIds(row.game_ids ?? "");
    let reason: string | null = null;
    if (!VIDEO_ID_PATTERN.test(id)) reason = "video_id isn't an 11-character YouTube id";
    else if (seen.has(id)) reason = `duplicate video_id ${id}`;
    else if (gameIds.length === 0) reason = "game_ids is empty";
    else if (gameIds.some((gameId) => !GAME_ID_PATTERN.test(gameId))) reason = "game_ids has an invalid game id";

    if (reason) {
      skipped.push({ file, row: number, reason });
      return;
    }
    seen.add(id);
    records.push({
      id,
      title: cleanText(row.title, MAX_VIDEO_TITLE_LENGTH) || id,
      publishedAt: (row.published_at ?? "").trim(),
      gameIds,
    });
  });
  return { records, skipped };
}

/** The game ids in a game_ids cell: separated by ";", blanks and repeats
 * dropped. */
export function splitGameIds(cell: string): string[] {
  return [...new Set(cell.split(GAME_ID_SEPARATOR).map((id) => id.trim()).filter((id) => id !== ""))];
}

/** Keeps only the game ids that name a game in `games`. A video left with
 * none is dropped; each id left off is listed, so nothing goes quietly. */
export function linkVideos(
  videos: readonly VideoRecord[],
  games: readonly GameRecord[],
): { videos: VideoRecord[]; skipped: SkippedRow[] } {
  const known = new Set(games.map((game) => game.id));
  const skipped: SkippedRow[] = [];
  const linked: VideoRecord[] = [];
  for (const video of videos) {
    const kept = video.gameIds.filter((id) => known.has(id));
    for (const id of video.gameIds) {
      if (!known.has(id)) skipped.push({ file: VIDEOS_FILE, row: null, reason: `${video.id}: no game with id ${id}` });
    }
    if (kept.length === 0) {
      skipped.push({ file: VIDEOS_FILE, row: null, reason: `${video.id}: none of its games exist, so the video is left out` });
    } else {
      linked.push({ ...video, gameIds: kept });
    }
  }
  return { videos: linked, skipped };
}

/** An ISO 8601 date or timestamp, or null. A date alone is that day in
 * local time: Date.parse would read it as UTC midnight, which shows as the
 * day before anywhere west of UTC. */
export function parseDate(value: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (day) {
    const [year, month, date] = day.slice(1).map(Number) as [number, number, number];
    const local = new Date(year, month - 1, date);
    return local.getMonth() === month - 1 && local.getDate() === date ? local : null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

/** ISO 8601 as the studio reads it: a bare date is midnight UTC, and a time
 * without an offset is UTC too. Returns YYYY-MM-DDTHH:MM:SSZ, or null. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|z|[+-]\d{2}:?\d{2})?)?$/;

export function normalizePublishedAt(text: string): string | null {
  const match = ISO_DATE.exec(text.trim());
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", zone] = match;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number) as [number, number, number, number, number, number];

  // Date's setters roll over (February 30 becomes March 1), so check the
  // fields read back as they were given.
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(hour, minute, second, 0);
  if (
    value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day
    || value.getUTCHours() !== hour || value.getUTCMinutes() !== minute || value.getUTCSeconds() !== second
  ) return null;

  const offset = zoneMinutes(zone);
  if (offset === null) return null;
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 19) + "Z";
}

/** The offset of "Z", "+02:00" or "-0530" in minutes; 0 when there's none. */
function zoneMinutes(zone: string | undefined): number | null {
  if (!zone || zone === "Z" || zone === "z") return 0;
  const digits = zone.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (hours > 23 || minutes > 59) return null;
  return (zone[0] === "-" ? -1 : 1) * (hours * 60 + minutes);
}

/** The title as the files hold it: commas and double quotes become ; and ',
 * so no title needs quoting. */
export function fileTitle(title: string): string {
  return tidy(title).replace(/,/g, ";").replace(/"/g, "'");
}

/** A CSV field, quoted only when it has to be, as Python's csv module does. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Games.txt as the studio writes it: a byte order mark (so Excel reads it
 * as UTF-8), CRLF line ends, sorted by title. */
export function toGamesFile(games: readonly GameRecord[]): string {
  const sorted = [...games].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const lines = [GAME_COLUMNS.join(",")];
  for (const game of sorted) lines.push([game.id, tidy(game.title)].map(csvField).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Videos.txt as the studio writes it: a byte order mark, CRLF line ends,
 * newest first. */
export function toVideosFile(videos: readonly VideoRecord[]): string {
  const sorted = [...videos].sort((a, b) => (parseDate(b.publishedAt)?.getTime() ?? 0) - (parseDate(a.publishedAt)?.getTime() ?? 0));
  const lines = [VIDEO_COLUMNS.join(",")];
  for (const video of sorted) {
    lines.push([video.id, fileTitle(video.title), video.publishedAt, video.gameIds.join(GAME_ID_SEPARATOR)].map(csvField).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------- The site's model ----------

export interface Video {
  readonly id: string;
  readonly title: string;
  readonly publishedAt: Date | null;
}

export interface Game {
  readonly id: string;
  readonly title: string;
  /** Newest first. Empty for a game with no videos yet. */
  readonly videos: readonly Video[];
  readonly letter: string | null;
  readonly searchText: string;
}

/** The YouTube page of a video. */
export function videoUrl(video: Video | { readonly id: string }): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
}

/** The WebP thumbnail that preload_media.py stores on the site. */
export function thumbnailUrl(video: { readonly id: string }): string {
  return `assets/thumbnails/${encodeURIComponent(video.id)}.webp`;
}

/** YouTube's own thumbnail, used until the site has its copy. */
export function remoteThumbnailUrl(video: { readonly id: string }): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
}

/** A game's cover (box art) that preload_media.py stores here. It
 * sits in the thumbnails folder, so the container's volume and the service
 * worker's cache already cover it. */
export function coverUrl(game: { readonly id: string }): string {
  return `assets/thumbnails/games/${encodeURIComponent(game.id)}.webp`;
}

/** The pictures for a video's card: the site's copy, then YouTube's. */
export function videoImages(video: { readonly id: string }): string[] {
  return [thumbnailUrl(video), remoteThumbnailUrl(video)];
}

/** The pictures for a game's card: its cover, then its newest video's. */
export function gameImages(game: Game): string[] {
  const newest = game.videos[0];
  return [coverUrl(game), ...(newest ? videoImages(newest) : [])];
}

const time = (video: Video) => video.publishedAt?.getTime() ?? 0;

/** The games, sorted by title, each with its videos newest first. */
export class Catalog {
  readonly games: readonly Game[];
  private readonly byId: ReadonlyMap<string, Game>;

  /** `videos` must be linked already (see linkVideos). */
  constructor(games: readonly GameRecord[], videos: readonly VideoRecord[]) {
    const byGame = new Map<string, Video[]>(games.map((game) => [game.id, []]));
    for (const record of videos) {
      const video: Video = Object.freeze({ id: record.id, title: record.title, publishedAt: parseDate(record.publishedAt) });
      for (const gameId of record.gameIds) byGame.get(gameId)?.push(video);
    }

    const built = games.map((game): Game => {
      const list = byGame.get(game.id) ?? [];
      return {
        id: game.id,
        title: game.title,
        videos: list.slice().sort((a, b) => time(b) - time(a)),
        letter: firstLetter(game.title),
        searchText: normalizeText(game.title),
      };
    });
    built.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    this.games = built;
    this.byId = new Map(built.map((game) => [game.id, game]));
  }

  get(id: string): Game | null {
    return this.byId.get(id) ?? null;
  }

  /** The letters that have at least one game: A-Z, then "#". */
  letters(): string[] {
    const present = new Set(this.games.map((game) => game.letter).filter((letter) => letter !== null));
    return [...present].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  }

  /** The games matching a search query (ignoring case and accents) and a
   * letter; an empty query or a null letter matches every game. */
  filter(query: string, letter: string | null): Game[] {
    const needle = normalizeText(query.trim());
    return this.games.filter((game) =>
      (!needle || game.searchText.includes(needle)) && (!letter || game.letter === letter));
  }

  /** Builds the catalog from the two files' text. Skipped rows are logged,
   * and the site shows what it has. */
  static fromFiles(gamesText: string, videosText: string): Catalog {
    const games = readGames(gamesText);
    const videos = readVideos(videosText);
    const linked = linkVideos(videos.records, games.records);
    for (const skip of [...games.skipped, ...videos.skipped, ...linked.skipped]) {
      console.warn(`${skip.file}${skip.row === null ? "" : ` row ${skip.row}`}: ${skip.reason}`);
    }
    return new Catalog(games.records, linked.videos);
  }

  /** Fetches both files, revalidating with the server, and builds the
   * catalog. Either one failing fails the load. */
  static async load(fetchImpl: typeof fetch = fetch): Promise<Catalog> {
    const [gamesText, videosText] = await Promise.all([fetchText(GAMES_URL, fetchImpl), fetchText(VIDEOS_URL, fetchImpl)]);
    return Catalog.fromFiles(gamesText, videosText);
  }
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load ${url.slice(url.lastIndexOf("/") + 1)} (${response.status})`);
  return response.text();
}

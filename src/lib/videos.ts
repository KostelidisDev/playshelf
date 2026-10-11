/* The catalog: videos.csv rows, validated and grouped into games. The
 * columns must match the manager's site CSV export
 * (manager/creator_manager/storage/site_csv.py). */

import { parseCSV, type CsvRecord } from "./csv.ts";
import { cleanText, firstLetter, normalizeText } from "./text.ts";

export const CSV_URL = "assets/api/videos.csv";
export const UNMATCHED_GROUP_TITLE = "Unmatched";

/** A YouTube id: 11 URL-safe characters. Every URL and file name built from
 * an id relies on this check, so a crafted row can't point a link or an
 * image anywhere else. sync-thumbnails.sh makes the same check. */
export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface Video {
  readonly id: string;
  readonly title: string;
  readonly publishedAt: Date | null;
  readonly gameTitle: string;
}

export interface Game {
  /** The game title as in the CSV; "" groups the videos without a game. */
  readonly key: string;
  readonly title: string;
  /** Newest first; never empty. */
  readonly videos: readonly Video[];
  readonly letter: string | null;
  readonly searchText: string;
}

/** The row as a video, or null when its id isn't valid. A missing title
 * falls back to the id, and a bad date to null. */
export function toVideo(row: Partial<CsvRecord>): Video | null {
  const id = String(row.video_id ?? "").trim();
  if (!VIDEO_ID_PATTERN.test(id)) return null;
  return Object.freeze({
    id,
    title: cleanText(row.title) || id,
    publishedAt: parseDate(row.published_at ?? ""),
    gameTitle: cleanText(row.game_title, 150),
  });
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

/** The video on YouTube. */
export function videoUrl(video: Video): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
}

/** The WebP thumbnail that sync-thumbnails.sh stores on the site. */
export function thumbnailUrl(video: Video): string {
  return `assets/thumbnails/${encodeURIComponent(video.id)}.webp`;
}

/** YouTube's own thumbnail, used until the site has its copy. */
export function remoteThumbnailUrl(video: Video): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
}

const time = (video: Video) => video.publishedAt?.getTime() ?? 0;

/** The games: one per game title, each with its videos newest first,
 * sorted by title, with the videos without a game ("Unmatched") last. */
export class GameCatalog {
  readonly games: readonly Game[];
  private readonly byKey: ReadonlyMap<string, Game>;

  constructor(videos: Iterable<Video>) {
    const byTitle = new Map<string, Video[]>();
    for (const video of videos) {
      const list = byTitle.get(video.gameTitle);
      if (list) list.push(video);
      else byTitle.set(video.gameTitle, [video]);
    }

    const games = [...byTitle.entries()].map(([key, list]): Game => {
      const title = key || UNMATCHED_GROUP_TITLE;
      return {
        key,
        title,
        videos: list.slice().sort((a, b) => time(b) - time(a)),
        letter: firstLetter(key),
        searchText: normalizeText(title),
      };
    });
    games.sort((a, b) => {
      if (a.key === "") return b.key === "" ? 0 : 1;
      if (b.key === "") return -1;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
    this.games = games;
    this.byKey = new Map(games.map((game) => [game.key, game]));
  }

  get(key: string): Game | null {
    return this.byKey.get(key) ?? null;
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

  /** Builds the catalog from videos.csv text, skipping invalid rows. */
  static fromCsv(text: string): GameCatalog {
    const rows = parseCSV(text);
    const videos = rows.map(toVideo).filter((video) => video !== null);
    if (videos.length < rows.length) console.warn(`Skipped ${rows.length - videos.length} invalid row(s) in videos.csv`);
    return new GameCatalog(videos);
  }

  /** Fetches videos.csv, revalidating with the server, and builds the
   * catalog. */
  static async load(url = CSV_URL, fetchImpl: typeof fetch = fetch): Promise<GameCatalog> {
    const response = await fetchImpl(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load videos.csv (${response.status})`);
    return GameCatalog.fromCsv(await response.text());
  }
}

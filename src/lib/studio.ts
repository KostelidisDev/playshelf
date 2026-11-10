/* The catalog editor's rules: checking a game or a video, the id a new game
 * gets, and the changes that keep the two files consistent (deleting a game
 * takes it off its videos). Reading and writing the files is in catalog.ts,
 * which holds the format both the site and the editor use. */

import {
  MAX_GAME_TITLE_LENGTH,
  MAX_VIDEO_TITLE_LENGTH,
  VIDEO_ID_PATTERN,
  normalizePublishedAt,
  parseDate,
  type GameRecord,
  type VideoRecord,
} from "./catalog.ts";
import { cleanText, normalizeText } from "./text.ts";

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

// ---------- Games ----------

export type GameChecked = { ok: true; title: string } | { ok: false; error: string };

/** A game's title, cleaned, or the reason it can't be saved. */
export function checkGameTitle(text: string): GameChecked {
  const title = cleanText(text, Number.POSITIVE_INFINITY);
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > MAX_GAME_TITLE_LENGTH) return { ok: false, error: `Title is too long (max ${MAX_GAME_TITLE_LENGTH} characters).` };
  return { ok: true, title };
}

/** The id for a new game, made from its title: lowercase, without accents,
 * words joined by "-". A number is added when the id is already taken. The
 * id is fixed once saved, so renaming a game never breaks its videos. */
export function newGameId(title: string, taken: ReadonlySet<string>): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/, "") || "game";
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const id = `${slug}-${n}`;
    if (!taken.has(id)) return id;
  }
}

/** Adds `game`, or with `replacing` set (the id being edited), swaps that
 * game for it. Two games can't share a title, ignoring case, as the site
 * would show them as one game twice. */
export function putGame(
  games: readonly GameRecord[],
  game: GameRecord,
  replacing: string | null,
): { ok: true; games: GameRecord[] } | { ok: false; error: string } {
  const key = game.title.toLowerCase();
  if (games.some((other) => other.id !== replacing && other.title.toLowerCase() === key)) {
    return { ok: false, error: `There is already a game called “${game.title}”.` };
  }
  const next = replacing === null
    ? [...games, game]
    : games.map((other) => (other.id === replacing ? game : other));
  return { ok: true, games: next };
}

/** Deletes a game and takes it off every video. A video whose only game it
 * was is deleted too, and reported, since a video needs a game. */
export function removeGame(
  games: readonly GameRecord[],
  videos: readonly VideoRecord[],
  id: string,
): { games: GameRecord[]; videos: VideoRecord[]; removedVideos: VideoRecord[] } {
  const removedVideos: VideoRecord[] = [];
  const kept: VideoRecord[] = [];
  for (const video of videos) {
    if (!video.gameIds.includes(id)) {
      kept.push(video);
      continue;
    }
    const gameIds = video.gameIds.filter((gameId) => gameId !== id);
    if (gameIds.length === 0) removedVideos.push(video);
    else kept.push({ ...video, gameIds });
  }
  return { games: games.filter((game) => game.id !== id), videos: kept, removedVideos };
}

/** How many videos a game is on: what a delete will touch. */
export function videosOfGame(videos: readonly VideoRecord[], id: string): VideoRecord[] {
  return videos.filter((video) => video.gameIds.includes(id));
}

// ---------- Videos ----------

/** What the user typed, before it's checked. */
export interface VideoDraft {
  id: string;
  title: string;
  publishedAt: string;
  gameIds: readonly string[];
}

export type VideoField = "id" | "title" | "publishedAt" | "gameIds";
export type VideoChecked = { ok: true; record: VideoRecord } | { ok: false; errors: FieldErrors<VideoField> };

/** A YouTube id from a bare id or a youtube.com / youtu.be URL, or null. */
const URL_ID = /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)?([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/i;

export function parseVideoId(text: string): string | null {
  const trimmed = text.trim();
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;
  return URL_ID.exec(trimmed)?.[1] ?? null;
}

/** The ids of the games whose titles appear in a video's title, as whole
 * words ("Go" doesn't match "Good"), ignoring case, accents and punctuation.
 * Titles under three letters are left out: they match too much. */
export function gamesInTitle(title: string, games: readonly GameRecord[]): string[] {
  const words = (text: string) => ` ${normalizeText(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(" ")} `;
  const haystack = words(title);
  return games
    .filter((game) => {
      const needle = words(game.title);
      return needle.trim().length >= 3 && haystack.includes(needle);
    })
    .map((game) => game.id);
}

/** YouTube's oEmbed address for a video (a 11-character id, as parseVideoId
 * gives), which answers with the video's title and no key. */
export function oembedUrl(id: string): string {
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
}

/** The title in an oEmbed reply, cleaned, or null when the reply has none. */
export function oembedTitle(reply: unknown): string | null {
  if (typeof reply !== "object" || reply === null || !("title" in reply) || typeof reply.title !== "string") return null;
  return cleanText(reply.title, MAX_VIDEO_TITLE_LENGTH) || null;
}

/** YouTube Data API v3's video address for an id, with the key. It asks only
 * for the snippet's title and publish time, which is all the editor reads. */
export function dataApiUrl(id: string, key: string): string {
  const query = new URLSearchParams({ part: "snippet", id, key, fields: "items(snippet(title,publishedAt))" });
  return `https://www.googleapis.com/youtube/v3/videos?${query.toString()}`;
}

/** A video's title and publish time from a Data API reply, in the form the
 * file keeps the time in. Either is null when the reply lacks it; the whole
 * result is null when there's no video in the reply at all. */
export function dataApiVideo(reply: unknown): { title: string | null; publishedAt: string | null } | null {
  if (typeof reply !== "object" || reply === null || !("items" in reply) || !Array.isArray(reply.items)) return null;
  const item: unknown = reply.items[0];
  if (typeof item !== "object" || item === null || !("snippet" in item)) return null;
  const snippet: unknown = item.snippet;
  if (typeof snippet !== "object" || snippet === null) return null;
  const title = "title" in snippet && typeof snippet.title === "string" ? cleanText(snippet.title, MAX_VIDEO_TITLE_LENGTH) || null : null;
  const published = "publishedAt" in snippet && typeof snippet.publishedAt === "string" ? normalizePublishedAt(snippet.publishedAt) : null;
  return { title, publishedAt: published };
}

/** A published time as the picker shows it: the UTC day, hour and minute,
 * and the instant itself. Null when the value isn't a date. */
export interface PublishedParts {
  readonly day: string;
  readonly hour: number;
  readonly minute: number;
  readonly instant: Date;
}

export function publishedParts(value: string): PublishedParts | null {
  const utc = normalizePublishedAt(value);
  if (!utc) return null;
  return { day: utc.slice(0, 10), hour: Number(utc.slice(11, 13)), minute: Number(utc.slice(14, 16)), instant: new Date(utc) };
}

/** The value with its day, hour or minute changed, in the form the file keeps
 * (UTC, to the second). A day of "" clears it. Seconds the value already has
 * are kept, since the picker doesn't show them. */
export function setPublished(value: string, change: { day?: string; hour?: number; minute?: number }): string {
  const parts = publishedParts(value);
  const day = change.day ?? parts?.day ?? "";
  if (!day) return "";
  const hour = change.hour ?? parts?.hour ?? 0;
  const minute = change.minute ?? parts?.minute ?? 0;
  const seconds = parts ? parts.instant.toISOString().slice(17, 19) : "00";
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${seconds}Z`;
}

/** Checks a video. The games must exist (they come from the games list),
 * and there must be at least one. On success the record is cleaned, and its
 * date is saved in the studio's form (UTC). */
export function checkVideo(draft: VideoDraft, games: readonly GameRecord[]): VideoChecked {
  const errors: FieldErrors<VideoField> = {};

  const id = parseVideoId(draft.id);
  if (id === null) errors.id = "Video ID must be an 11-character YouTube id or a YouTube video URL.";

  const title = cleanText(draft.title, Number.POSITIVE_INFINITY);
  if (!title) errors.title = "Title is required.";
  else if (title.length > MAX_VIDEO_TITLE_LENGTH) errors.title = `Title is too long (max ${MAX_VIDEO_TITLE_LENGTH} characters).`;

  const publishedText = draft.publishedAt.trim();
  const publishedAt = normalizePublishedAt(publishedText);
  if (!publishedText) errors.publishedAt = "Published date is required.";
  else if (publishedAt === null) errors.publishedAt = `'${publishedText}' isn't a valid date, e.g. 2024-05-09T10:30:30Z.`;

  const known = new Set(games.map((game) => game.id));
  const gameIds = [...new Set(draft.gameIds)].filter((gameId) => known.has(gameId));
  if (gameIds.length === 0) errors.gameIds = "Choose at least one game.";

  if (id === null || publishedAt === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, record: { id, title, publishedAt, gameIds } };
}

/** Adds `record`, or with `replacing` set (the id being edited), swaps that
 * video for it. A video can't take an id another video already has. */
export function putVideo(
  videos: readonly VideoRecord[],
  record: VideoRecord,
  replacing: string | null,
): { ok: true; videos: VideoRecord[] } | { ok: false; errors: FieldErrors<VideoField> } {
  if (videos.some((other) => other.id === record.id && other.id !== replacing)) {
    return { ok: false, errors: { id: "That video is already in the list." } };
  }
  const next = replacing === null
    ? [...videos, record]
    : videos.map((other) => (other.id === replacing ? record : other));
  return { ok: true, videos: next };
}

export function removeVideo(videos: readonly VideoRecord[], id: string): VideoRecord[] {
  return videos.filter((video) => video.id !== id);
}

// ---------- Pictures ----------

/** Each game's newest video, by publish date. A game without a cover shows
 * its picture, as on the site. */
export function newestVideoByGame(videos: readonly VideoRecord[]): Map<string, VideoRecord> {
  const time = (video: VideoRecord) => parseDate(video.publishedAt)?.getTime() ?? 0;
  const newest = new Map<string, VideoRecord>();
  for (const video of videos) {
    for (const gameId of video.gameIds) {
      const current = newest.get(gameId);
      if (current === undefined || time(video) > time(current)) newest.set(gameId, video);
    }
  }
  return newest;
}

/** The studio sits one folder down (/studio/), so the site's relative picture
 * paths need a "../" in front. Remote pictures are left as they are. */
export function studioPicture(url: string): string {
  return url.startsWith("https://") ? url : `../${url}`;
}

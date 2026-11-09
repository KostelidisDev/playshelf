/* The catalog editor's rules: reading an uploaded videos.csv, checking a
 * record, and writing the file back. They follow PlayShelf Studio's own
 * rules (validation.py, video_rows.py and site_csv.py in playshelf-studio),
 * so a file made here loads in the studio and on the site, and the other
 * way round. The four columns are the contract with the site. */

import { parseCSVTable, type CsvRecord } from "./csv.ts";
import { cleanText } from "./text.ts";
import { VIDEO_ID_PATTERN } from "./videos.ts";

export const CATALOG_COLUMNS = ["video_id", "title", "published_at", "game_title"] as const;
/** The file's name when it's saved: the name the site reads. */
export const CATALOG_FILE_NAME = "videos.csv";
/** The studio's own limit for a catalog file; anything bigger is the wrong file. */
export const MAX_CATALOG_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_TITLE_LENGTH = 200;
export const MAX_GAME_TITLE_LENGTH = 150;

/** One video, as the editor holds it. `publishedAt` is always
 * YYYY-MM-DDTHH:MM:SSZ (UTC), the form the studio writes. */
export interface VideoRecord {
  readonly id: string;
  readonly title: string;
  readonly publishedAt: string;
  readonly gameTitle: string;
}

/** What the user typed, before it's checked. */
export interface Draft {
  id: string;
  title: string;
  publishedAt: string;
  gameTitle: string;
}

export type Field = keyof Draft;
export type FieldErrors = Partial<Record<Field, string>>;
export type Checked = { ok: true; record: VideoRecord } | { ok: false; errors: FieldErrors };

export interface SkippedRow {
  /** 1-based number of the data row (the header isn't counted). */
  readonly row: number;
  readonly reason: string;
}

export interface LoadedCatalog {
  readonly records: readonly VideoRecord[];
  readonly skipped: readonly SkippedRow[];
}

/** A file that isn't a catalog at all: it's missing a column. Rows that
 * are merely invalid are skipped and reported, not thrown. */
export class CatalogFormatError extends Error {
  override name = "CatalogFormatError";
}

/** Text with control and bidi characters removed and whitespace collapsed,
 * but no length cap, so the length check can say what went wrong. */
function tidy(value: string): string {
  return cleanText(value, Number.POSITIVE_INFINITY);
}

/** A YouTube id from a bare id or a youtube.com / youtu.be URL, or null. */
const URL_ID = /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)?([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/i;

export function parseVideoId(text: string): string | null {
  const trimmed = text.trim();
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;
  return URL_ID.exec(trimmed)?.[1] ?? null;
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

/** Checks a draft. On success, the record is cleaned and normalised. */
export function checkRecord(draft: Draft): Checked {
  const errors: FieldErrors = {};

  const id = parseVideoId(draft.id);
  if (id === null) errors.id = "Video ID must be an 11-character YouTube id or a YouTube video URL.";

  const title = tidy(draft.title);
  if (!title) errors.title = "Title is required.";
  else if (title.length > MAX_VIDEO_TITLE_LENGTH) errors.title = `Title is too long (max ${MAX_VIDEO_TITLE_LENGTH} characters).`;

  const publishedText = draft.publishedAt.trim();
  const publishedAt = normalizePublishedAt(publishedText);
  if (!publishedText) errors.publishedAt = "Published date is required.";
  else if (publishedAt === null) errors.publishedAt = `'${publishedText}' isn't a valid date, e.g. 2024-05-09T10:30:30Z.`;

  const gameTitle = tidy(draft.gameTitle);
  if (gameTitle.length > MAX_GAME_TITLE_LENGTH) errors.gameTitle = `Game title is too long (max ${MAX_GAME_TITLE_LENGTH} characters).`;

  if (id === null || publishedAt === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, record: { id, title, publishedAt, gameTitle } };
}

/** Reads a catalog file. Throws CatalogFormatError when a column is missing;
 * rows that don't check out (or repeat an earlier id) are skipped and listed. */
export function readCatalog(text: string, fileName: string = CATALOG_FILE_NAME): LoadedCatalog {
  const { header, rows } = parseCSVTable(text);
  const missing = CATALOG_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new CatalogFormatError(`${fileName} is missing column(s): ${missing.join(", ")}.`);
  }

  const records: VideoRecord[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();
  rows.forEach((row: CsvRecord, index) => {
    const number = index + 1;
    const checked = checkRecord({
      id: row.video_id ?? "",
      title: row.title ?? "",
      publishedAt: row.published_at ?? "",
      gameTitle: row.game_title ?? "",
    });
    if (!checked.ok) {
      skipped.push({ row: number, reason: Object.values(checked.errors)[0] ?? "Invalid row." });
    } else if (seen.has(checked.record.id)) {
      skipped.push({ row: number, reason: `duplicate video id ${checked.record.id}` });
    } else {
      seen.add(checked.record.id);
      records.push(checked.record);
    }
  });
  return { records: canonicalGameTitles(records), skipped };
}

/** The key that tells game titles apart: case and spacing don't count. */
export function gameKey(title: string): string {
  return tidy(title).toLowerCase();
}

/** Gives every game one spelling, the first one in the list, as the studio
 * does, so "KINGDOM HEARTS III" and "Kingdom Hearts III" are one game. */
export function canonicalGameTitles(records: readonly VideoRecord[]): VideoRecord[] {
  const spelling = new Map<string, string>();
  return records.map((record) => {
    const key = gameKey(record.gameTitle);
    if (key === "") return record;
    let gameTitle = spelling.get(key);
    if (gameTitle === undefined) {
      gameTitle = tidy(record.gameTitle);
      spelling.set(key, gameTitle);
    }
    return gameTitle === record.gameTitle ? record : { ...record, gameTitle };
  });
}

/** Adds `record`, or with `replacing` set (the id being edited), swaps that
 * record for it. A record can't take an id another record already has. */
export function putRecord(
  records: readonly VideoRecord[],
  record: VideoRecord,
  replacing: string | null,
): { ok: true; records: VideoRecord[] } | { ok: false; errors: FieldErrors } {
  if (records.some((other) => other.id === record.id && other.id !== replacing)) {
    return { ok: false, errors: { id: "That video is already in the catalog." } };
  }
  const next = replacing === null
    ? [...records, record]
    : records.map((other) => (other.id === replacing ? record : other));
  return { ok: true, records: canonicalGameTitles(next) };
}

export function removeRecord(records: readonly VideoRecord[], id: string): VideoRecord[] {
  return records.filter((record) => record.id !== id);
}

/** Newest first, as the site shows them. Equal dates keep their order. */
export function sortNewestFirst(records: readonly VideoRecord[]): VideoRecord[] {
  return [...records].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** The distinct game titles, sorted, for suggestions while typing. */
export function gameTitles(records: readonly VideoRecord[]): string[] {
  const titles = new Map<string, string>();
  for (const record of records) {
    const key = gameKey(record.gameTitle);
    if (key !== "" && !titles.has(key)) titles.set(key, record.gameTitle);
  }
  return [...titles.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** The title as the site file holds it: commas and double quotes become
 * ; and ', as in the studio's export, so no title needs quoting. */
function siteTitle(title: string): string {
  return tidy(title).replace(/,/g, ";").replace(/"/g, "'");
}

/** A CSV field, quoted only when it has to be, as Python's csv module does. */
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The videos.csv the site reads: a UTF-8 byte order mark (so Excel reads
 * it as UTF-8), CRLF line ends, newest first. */
export function toCatalogCsv(records: readonly VideoRecord[]): string {
  const lines = [CATALOG_COLUMNS.join(",")];
  for (const record of sortNewestFirst(records)) {
    lines.push([record.id, siteTitle(record.title), record.publishedAt, record.gameTitle].map(field).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

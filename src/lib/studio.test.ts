import { describe, expect, it } from "vitest";
import { parseCSV } from "./csv.ts";
import {
  CatalogFormatError,
  canonicalGameTitles,
  checkRecord,
  gameTitles,
  normalizePublishedAt,
  parseVideoId,
  putRecord,
  readCatalog,
  removeRecord,
  sortNewestFirst,
  toCatalogCsv,
  type Draft,
  type VideoRecord,
} from "./studio.ts";

const ID_A = "o9KQ4rlymEQ";
const ID_B = "2VawSnaxtSI";
const ID_C = "GWlKEM3m2EE";

const draft = (overrides: Partial<Draft> = {}): Draft => ({
  id: ID_A,
  title: "A trailer",
  publishedAt: "2024-06-09",
  gameTitle: "Game One",
  ...overrides,
});

const record = (overrides: Partial<VideoRecord> = {}): VideoRecord => ({
  id: ID_A,
  title: "A trailer",
  publishedAt: "2024-06-09T00:00:00Z",
  gameTitle: "Game One",
  ...overrides,
});

describe("normalizePublishedAt", () => {
  it("reads a bare date as midnight UTC, as the studio does", () => {
    expect(normalizePublishedAt("2024-05-09")).toBe("2024-05-09T00:00:00Z");
  });

  it("keeps a UTC timestamp and drops fractions of a second", () => {
    expect(normalizePublishedAt("2024-05-09T10:30:30Z")).toBe("2024-05-09T10:30:30Z");
    expect(normalizePublishedAt("2024-05-09T10:30:30.123z")).toBe("2024-05-09T10:30:30Z");
  });

  it("takes a time without an offset as UTC, with or without seconds, and a space or T", () => {
    expect(normalizePublishedAt("2024-05-09 10:30")).toBe("2024-05-09T10:30:00Z");
  });

  it("converts an offset to UTC", () => {
    expect(normalizePublishedAt("2024-05-09T12:30:00+02:00")).toBe("2024-05-09T10:30:00Z");
    expect(normalizePublishedAt("2024-05-09T05:00:00-0530")).toBe("2024-05-09T10:30:00Z");
  });

  it("rejects dates that don't exist, and times out of range", () => {
    expect(normalizePublishedAt("2024-02-30")).toBeNull();
    expect(normalizePublishedAt("2024-13-01")).toBeNull();
    expect(normalizePublishedAt("2024-05-09T25:00")).toBeNull();
    expect(normalizePublishedAt("2024-05-09T10:00+25:00")).toBeNull();
  });

  it("rejects text that isn't a date", () => {
    expect(normalizePublishedAt("soon")).toBeNull();
    expect(normalizePublishedAt("09/05/2024")).toBeNull();
    expect(normalizePublishedAt("")).toBeNull();
  });
});

describe("parseVideoId", () => {
  it("accepts a bare id and the usual YouTube URLs", () => {
    expect(parseVideoId(ID_A)).toBe(ID_A);
    expect(parseVideoId(` https://www.youtube.com/watch?v=${ID_A}&t=10 `)).toBe(ID_A);
    expect(parseVideoId(`https://youtu.be/${ID_A}`)).toBe(ID_A);
    expect(parseVideoId(`https://m.youtube.com/shorts/${ID_A}`)).toBe(ID_A);
  });

  it("rejects ids of the wrong length or with other characters", () => {
    expect(parseVideoId("short")).toBeNull();
    expect(parseVideoId("o9KQ4rlymEQX")).toBeNull();
    expect(parseVideoId("o9KQ4rly!EQ")).toBeNull();
    expect(parseVideoId("https://example.com/watch?v=" + ID_A)).toBeNull();
  });
});

describe("checkRecord", () => {
  it("returns a cleaned, normalised record", () => {
    const checked = checkRecord(draft({ id: `https://youtu.be/${ID_A}`, title: "  Tab\tand\nlines  ", publishedAt: "2024-06-09T10:00:00+02:00" }));
    expect(checked).toEqual({
      ok: true,
      record: { id: ID_A, title: "Tab and lines", publishedAt: "2024-06-09T08:00:00Z", gameTitle: "Game One" },
    });
  });

  it("allows an empty game, which puts the video under no game", () => {
    expect(checkRecord(draft({ gameTitle: "  " }))).toMatchObject({ ok: true, record: { gameTitle: "" } });
  });

  it("reports each bad field, in plain words", () => {
    const checked = checkRecord({ id: "nope", title: "   ", publishedAt: "", gameTitle: "" });
    expect(checked).toEqual({
      ok: false,
      errors: {
        id: "Video ID must be an 11-character YouTube id or a YouTube video URL.",
        title: "Title is required.",
        publishedAt: "Published date is required.",
      },
    });
  });

  it("names a date it can't read", () => {
    const checked = checkRecord(draft({ publishedAt: "2024-02-30" }));
    expect(checked).toEqual({ ok: false, errors: { publishedAt: "'2024-02-30' isn't a valid date, e.g. 2024-05-09T10:30:30Z." } });
  });

  it("caps the title and the game title at the studio's lengths", () => {
    expect(checkRecord(draft({ title: "x".repeat(200) })).ok).toBe(true);
    expect(checkRecord(draft({ title: "x".repeat(201) }))).toMatchObject({ ok: false, errors: { title: expect.stringContaining("max 200") } });
    expect(checkRecord(draft({ gameTitle: "g".repeat(151) }))).toMatchObject({ ok: false, errors: { gameTitle: expect.stringContaining("max 150") } });
  });
});

describe("readCatalog", () => {
  it("reads the site's file: BOM, quoted commas and a missing game", () => {
    const text = '﻿video_id,title,published_at,game_title\r\n'
      + `${ID_A},"Trailer, part 1",2024-06-09,"Game, Deluxe"\r\n`
      + `${ID_B},Opening,2018-12-09,\r\n`;
    const loaded = readCatalog(text);
    expect(loaded.skipped).toEqual([]);
    expect(loaded.records).toEqual([
      { id: ID_A, title: "Trailer, part 1", publishedAt: "2024-06-09T00:00:00Z", gameTitle: "Game, Deluxe" },
      { id: ID_B, title: "Opening", publishedAt: "2018-12-09T00:00:00Z", gameTitle: "" },
    ]);
  });

  it("skips invalid rows and repeated ids, and says why", () => {
    const text = "video_id,title,published_at,game_title\n"
      + `${ID_A},First,2024-06-09,G\n`
      + "bad,Second,2024-06-09,G\n"
      + `${ID_A},Again,2024-06-10,G\n`
      + `${ID_B},Third,2024-02-30,G\n`
      + `${ID_C},Fourth,2024-06-11,G\n`;
    const loaded = readCatalog(text);
    expect(loaded.records.map((r) => r.id)).toEqual([ID_A, ID_C]);
    expect(loaded.skipped).toEqual([
      { row: 2, reason: "Video ID must be an 11-character YouTube id or a YouTube video URL." },
      { row: 3, reason: `duplicate video id ${ID_A}` },
      { row: 4, reason: "'2024-02-30' isn't a valid date, e.g. 2024-05-09T10:30:30Z." },
    ]);
  });

  it("names the missing columns of a file that isn't a catalog", () => {
    expect(() => readCatalog("video_id,title\nx,y\n", "other.csv")).toThrow(CatalogFormatError);
    expect(() => readCatalog("video_id,title\nx,y\n", "other.csv")).toThrow("other.csv is missing column(s): published_at, game_title.");
  });

  it("reads a file with a header and no rows as an empty catalog", () => {
    expect(readCatalog("video_id,title,published_at,game_title\n")).toEqual({ records: [], skipped: [] });
  });

  it("gives each game one spelling, the first one", () => {
    const text = "video_id,title,published_at,game_title\n"
      + `${ID_A},One,2024-06-09,KINGDOM HEARTS III\n`
      + `${ID_B},Two,2024-06-08,Kingdom  hearts iii\n`;
    expect(readCatalog(text).records.map((r) => r.gameTitle)).toEqual(["KINGDOM HEARTS III", "KINGDOM HEARTS III"]);
  });
});

describe("toCatalogCsv", () => {
  const records = [
    record({ id: ID_B, title: 'Old "classic", remaster', publishedAt: "2018-12-09T00:00:00Z", gameTitle: "Game One" }),
    record({ id: ID_A, title: "New", publishedAt: "2024-06-09T00:00:00Z", gameTitle: "Game, Two" }),
  ];

  it("writes a BOM, the header, CRLF line ends and the rows newest first", () => {
    const text = toCatalogCsv(records);
    expect(text.startsWith("﻿video_id,title,published_at,game_title\r\n")).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.split("\r\n")[1]).toBe(`${ID_A},New,2024-06-09T00:00:00Z,"Game, Two"`);
  });

  it("swaps commas and double quotes in titles, as the studio's export does", () => {
    expect(toCatalogCsv(records)).toContain(`${ID_B},Old 'classic'; remaster,2018-12-09T00:00:00Z,Game One`);
  });

  it("quotes only the fields that need it, and reads back as the same catalog", () => {
    const text = toCatalogCsv([record({ title: "Plain", gameTitle: 'Say "hi", friend' })]);
    expect(parseCSV(text.slice(1))).toEqual([
      { video_id: ID_A, title: "Plain", published_at: "2024-06-09T00:00:00Z", game_title: 'Say "hi", friend' },
    ]);
    const loaded = readCatalog(toCatalogCsv(records));
    expect(loaded.records).toEqual(sortNewestFirst(records.map((r) => ({ ...r, title: r.title.replace(/,/g, ";").replace(/"/g, "'") }))));
  });

  it("writes a header-only file for an empty catalog", () => {
    expect(toCatalogCsv([])).toBe("﻿video_id,title,published_at,game_title\r\n");
  });
});

describe("catalog changes", () => {
  it("adds a record, and refuses an id the catalog already has", () => {
    const existing = [record()];
    const added = putRecord(existing, record({ id: ID_B }), null);
    expect(added).toEqual({ ok: true, records: [record(), record({ id: ID_B })] });
    expect(putRecord(existing, record(), null)).toEqual({ ok: false, errors: { id: "That video is already in the catalog." } });
  });

  it("replaces the record being edited in place, keeping its own id", () => {
    const existing = [record(), record({ id: ID_B })];
    const edited = putRecord(existing, record({ title: "Changed" }), ID_A);
    expect(edited).toEqual({ ok: true, records: [record({ title: "Changed" }), record({ id: ID_B })] });
  });

  it("refuses an edit that takes another record's id", () => {
    const existing = [record(), record({ id: ID_B })];
    expect(putRecord(existing, record({ id: ID_B }), ID_A)).toMatchObject({ ok: false });
  });

  it("uses the spelling a game already has when a new video names it differently", () => {
    const existing = [record({ gameTitle: "Game One" })];
    const added = putRecord(existing, record({ id: ID_B, gameTitle: "  game   one " }), null);
    expect(added).toMatchObject({ ok: true, records: [{ gameTitle: "Game One" }, { id: ID_B, gameTitle: "Game One" }] });
  });

  it("removes a record by id", () => {
    expect(removeRecord([record(), record({ id: ID_B })], ID_A)).toEqual([record({ id: ID_B })]);
  });

  it("lists each game title once, sorted, without the empty one", () => {
    const list = [record({ gameTitle: "beta" }), record({ id: ID_B, gameTitle: "Alpha" }), record({ id: ID_C, gameTitle: "" })];
    expect(gameTitles(list)).toEqual(["Alpha", "beta"]);
  });

  it("canonicalGameTitles leaves records without a game alone", () => {
    const list = [record({ gameTitle: "" })];
    expect(canonicalGameTitles(list)).toEqual(list);
  });
});

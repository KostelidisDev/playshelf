import { describe, expect, it, vi } from "vitest";
import {
  Catalog,
  CatalogFormatError,
  coverUrl,
  fileTitle,
  gameImages,
  linkVideos,
  normalizePublishedAt,
  parseDate,
  readGames,
  readVideos,
  remoteThumbnailUrl,
  thumbnailUrl,
  toGamesFile,
  toVideosFile,
  videoImages,
  videoUrl,
} from "./catalog.ts";

const BOM = "﻿";
const GAMES_HEADER = "game_id,title";
const VIDEOS_HEADER = "video_id,title,published_at,game_ids";
const ID = "tW8maoQNthw";

describe("readGames", () => {
  it("reads rows, trimming the id and cleaning the title", () => {
    const { records, skipped } = readGames(`${BOM}${GAMES_HEADER}\r\n zelda ,  The   Legend\u0007 of Zelda \r\n`);
    expect(records).toEqual([{ id: "zelda", title: "The Legend of Zelda" }]);
    expect(skipped).toEqual([]);
  });

  it("skips rows with a bad id, an empty or long title, or a repeated id, and says why", () => {
    const text = [
      GAMES_HEADER,
      "bad id,Title",
      "ok,",
      `long,${"x".repeat(151)}`,
      "dup,First",
      "dup,Second",
      "fine,Fine",
    ].join("\n");
    const { records, skipped } = readGames(text);
    expect(records).toEqual([{ id: "dup", title: "First" }, { id: "fine", title: "Fine" }]);
    expect(skipped.map((s) => [s.row, s.reason.split(" ")[0]])).toEqual([[1, "game_id"], [2, "title"], [3, "title"], [5, "duplicate"]]);
    expect(skipped[0]).toMatchObject({ file: "Games.txt", row: 1 });
  });

  it("keeps a title with commas, quoted in the file", () => {
    expect(readGames(`${GAMES_HEADER}\nff7,"Final Fantasy VII, Remake"\n`).records).toEqual([{ id: "ff7", title: "Final Fantasy VII, Remake" }]);
  });

  it("throws a format error when a column is missing", () => {
    expect(() => readGames("game_id\nzelda\n")).toThrow(CatalogFormatError);
    expect(() => readGames("game_id\nzelda\n")).toThrow("Games.txt is missing column(s): title.");
  });
});

describe("readVideos", () => {
  it("reads the game ids separated by semicolons, without blanks or repeats", () => {
    const { records } = readVideos(`${VIDEOS_HEADER}\n${ID},Hi,2022-06-20T11:02:29Z, zelda ;apex;;zelda\n`);
    expect(records).toEqual([{ id: ID, title: "Hi", publishedAt: "2022-06-20T11:02:29Z", gameIds: ["zelda", "apex"] }]);
  });

  it("skips rows with a bad video id, a repeated id, no game, or a bad game id", () => {
    const text = [
      VIDEOS_HEADER,
      "short,T,,zelda",
      `${ID},T,,zelda`,
      `${ID},Again,,zelda`,
      "aaaaaaaaaaa,T,,",
      "bbbbbbbbbbb,T,,bad game",
    ].join("\n");
    const { records, skipped } = readVideos(text);
    expect(records.map((r) => r.id)).toEqual([ID]);
    expect(skipped.map((s) => s.row)).toEqual([1, 3, 4, 5]);
  });

  it("shows the id for a missing title and keeps a date it can't read", () => {
    expect(readVideos(`${VIDEOS_HEADER}\n${ID},,nope,zelda\n`).records[0]).toMatchObject({ title: ID, publishedAt: "nope" });
  });

  it("throws a format error when a column is missing", () => {
    expect(() => readVideos("video_id,title,game_ids\n")).toThrow("Videos.txt is missing column(s): published_at.");
  });
});

describe("linkVideos", () => {
  const games = [{ id: "zelda", title: "Zelda" }, { id: "apex", title: "Apex" }];

  it("keeps only the games that exist, listing each id left off", () => {
    const videos = [
      { id: ID, title: "A", publishedAt: "", gameIds: ["zelda", "gone"] },
      { id: "bbbbbbbbbbb", title: "B", publishedAt: "", gameIds: ["gone"] },
    ];
    const { videos: linked, skipped } = linkVideos(videos, games);
    expect(linked).toEqual([{ id: ID, title: "A", publishedAt: "", gameIds: ["zelda"] }]);
    expect(skipped.map((s) => s.reason)).toEqual([
      `${ID}: no game with id gone`,
      "bbbbbbbbbbb: no game with id gone",
      "bbbbbbbbbbb: none of its games exist, so the video is left out",
    ]);
  });
});

describe("dates", () => {
  it("reads dates as local days and timestamps as instants", () => {
    expect(parseDate(" 2024-06-09 ")).toEqual(new Date(2024, 5, 9));
    expect(parseDate("2022-06-20T11:02:29Z")).toEqual(new Date("2022-06-20T11:02:29Z"));
  });

  it.each(["", "nope", "2024-02-30", "2024-13-01"])("rejects %j", (value) => {
    expect(parseDate(value)).toBeNull();
  });

  it("normalises to UTC the way the studio does", () => {
    expect(normalizePublishedAt("2024-05-09")).toBe("2024-05-09T00:00:00Z");
    expect(normalizePublishedAt("2024-05-09T10:30:30+02:00")).toBe("2024-05-09T08:30:30Z");
    expect(normalizePublishedAt("2024-05-09 10:30")).toBe("2024-05-09T10:30:00Z");
    expect(normalizePublishedAt("2024-02-30")).toBeNull();
    expect(normalizePublishedAt("2024-05-09T10:30:30+25:00")).toBeNull();
  });
});

describe("URLs and pictures", () => {
  it("build YouTube, thumbnail and cover URLs from validated ids", () => {
    expect(videoUrl({ id: ID })).toBe("https://www.youtube.com/watch?v=tW8maoQNthw");
    expect(thumbnailUrl({ id: ID })).toBe("assets/thumbnails/tW8maoQNthw.webp");
    expect(remoteThumbnailUrl({ id: ID })).toBe("https://i.ytimg.com/vi/tW8maoQNthw/hqdefault.jpg");
    expect(coverUrl({ id: "clair-obscur" })).toBe("assets/thumbnails/games/clair-obscur.webp");
  });

  it("gives a game its cover, then its newest video's pictures", () => {
    const catalog = Catalog.fromFiles(
      `${GAMES_HEADER}\nzelda,Zelda\n`,
      `${VIDEOS_HEADER}\n${ID},Hi,2022-06-20,zelda\n`,
    );
    const zelda = catalog.get("zelda")!;
    expect(gameImages(zelda, zelda.videos[0])).toEqual([
      "assets/thumbnails/games/zelda.webp",
      "assets/thumbnails/tW8maoQNthw.webp",
      "https://i.ytimg.com/vi/tW8maoQNthw/hqdefault.jpg",
    ]);
    expect(videoImages({ id: ID })).toHaveLength(2);
  });
});

describe("Catalog", () => {
  const games = [
    { id: "zelda", title: "zelda" },
    { id: "apex", title: "Apex" },
    { id: "empty", title: "Empty Game" },
    { id: "elan", title: "Élan" },
    { id: "omega", title: "Ωμέγα" },
  ];
  const videos = [
    { id: "aaaaaaaaaa1", title: "Old", publishedAt: "2020-01-01T00:00:00Z", gameIds: ["zelda"] },
    { id: "aaaaaaaaaa2", title: "Apex", publishedAt: "2021-01-01T00:00:00Z", gameIds: ["apex", "zelda"] },
    { id: "aaaaaaaaaa3", title: "New", publishedAt: "2023-01-01T00:00:00Z", gameIds: ["zelda"] },
    { id: "aaaaaaaaaa5", title: "Omega", publishedAt: "2019-01-01T00:00:00Z", gameIds: ["omega"] },
    { id: "aaaaaaaaaa6", title: "Elan", publishedAt: "", gameIds: ["elan"] },
  ];
  const catalog = new Catalog(games, videos);

  it("lists every game, sorted by title, including games with no videos", () => {
    expect(catalog.games.map((g) => g.title)).toEqual(["Apex", "Élan", "Empty Game", "zelda", "Ωμέγα"]);
    expect(catalog.get("empty")!.videos).toEqual([]);
  });

  it("puts a video on each of its games, newest first", () => {
    expect(catalog.get("zelda")!.videos.map((v) => v.id)).toEqual(["aaaaaaaaaa3", "aaaaaaaaaa2", "aaaaaaaaaa1"]);
    expect(catalog.get("apex")!.videos.map((v) => v.id)).toEqual(["aaaaaaaaaa2"]);
  });

  it("looks games up by id", () => {
    expect(catalog.get("apex")!.title).toBe("Apex");
    expect(catalog.get("missing")).toBeNull();
  });

  it("lists letters A-Z then #", () => {
    expect(catalog.letters()).toEqual(["A", "E", "Z", "#"]);
  });

  it("filters by accent-insensitive query and letter", () => {
    expect(catalog.filter("elan", null).map((g) => g.id)).toEqual(["elan"]);
    expect(catalog.filter("  ", "Z").map((g) => g.id)).toEqual(["zelda"]);
    expect(catalog.filter("apex", "Z")).toEqual([]);
    expect(catalog.filter("", null)).toHaveLength(5);
  });

  it("builds from the two files, logging rows it leaves out", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = Catalog.fromFiles(
      `${GAMES_HEADER}\ng1,G\n`,
      `${VIDEOS_HEADER}\n${ID},A,2022-06-20T11:02:29Z,g1;nope\nbad,B,,g1\n`,
    );
    expect(built.get("g1")!.videos.map((v) => v.id)).toEqual([ID]);
    expect(warn).toHaveBeenCalledWith(`Videos.txt: ${ID}: no game with id nope`);
    expect(warn).toHaveBeenCalledWith("Videos.txt row 2: video_id isn't an 11-character YouTube id");
    warn.mockRestore();
  });

  it("loads both files over fetch and reports HTTP errors", async () => {
    const responses: Record<string, string> = {
      "assets/api/Games.txt": `${GAMES_HEADER}\ng1,G\n`,
      "assets/api/Videos.txt": `${VIDEOS_HEADER}\n${ID},A,,g1\n`,
    };
    const ok = vi.fn(async (url: string) => new Response(responses[url]));
    expect((await Catalog.load(ok as unknown as typeof fetch)).games).toHaveLength(1);
    expect(ok).toHaveBeenCalledWith("assets/api/Games.txt", { cache: "no-cache" });

    const fail = vi.fn(async (url: string) => (url.endsWith("Videos.txt") ? new Response("", { status: 401 }) : new Response("")));
    await expect(Catalog.load(fail as unknown as typeof fetch)).rejects.toThrow("Could not load Videos.txt (401)");
  });
});

describe("writing the files", () => {
  it("writes Games.txt with a BOM, CRLF and games sorted by title", () => {
    const text = toGamesFile([{ id: "b", title: "Beta, Part 2" }, { id: "a", title: "alpha" }]);
    expect(text).toBe(`${BOM}game_id,title\r\na,alpha\r\nb,"Beta, Part 2"\r\n`);
  });

  it("writes Videos.txt newest first, joining the game ids with semicolons", () => {
    const text = toVideosFile([
      { id: "old", title: "Old", publishedAt: "2020-01-01", gameIds: ["a"] },
      { id: ID, title: 'Say "hi", friend', publishedAt: "2024-01-01T00:00:00Z", gameIds: ["a", "b"] },
    ]);
    expect(text).toBe(`${BOM}video_id,title,published_at,game_ids\r\n${ID},Say 'hi'; friend,2024-01-01T00:00:00Z,a;b\r\nold,Old,2020-01-01,a\r\n`);
  });

  it("round-trips through the readers", () => {
    const games = readGames(toGamesFile([{ id: "a", title: "Alpha" }])).records;
    const videos = readVideos(toVideosFile([{ id: ID, title: "T", publishedAt: "2024-05-09T10:30:30Z", gameIds: ["a"] }])).records;
    expect(linkVideos(videos, games).videos).toEqual([{ id: ID, title: "T", publishedAt: "2024-05-09T10:30:30Z", gameIds: ["a"] }]);
  });

  it("makes video titles file-safe, replacing commas and double quotes", () => {
    expect(fileTitle('a, "b"')).toBe("a; 'b'");
  });

  it("guards titles that a spreadsheet would read as a formula, in both files", () => {
    expect(toGamesFile([{ id: "a", title: "=HYPERLINK(x)" }])).toContain(`${BOM}game_id,title\r\na,'=HYPERLINK(x)\r\n`);
    expect(toVideosFile([{ id: ID, title: "+1 @ home", publishedAt: "2024-01-01", gameIds: ["a"] }]))
      .toContain(`${ID},'+1 @ home,`);
    expect(fileTitle("-dash")).toBe("'-dash");
    expect(fileTitle("Plain - dash in the middle")).toBe("Plain - dash in the middle");
  });

  it("reads a guarded title back with its apostrophe, and does not add a second one on the next write", () => {
    const once = readGames(toGamesFile([{ id: "a", title: "=x" }])).records[0]!.title;
    expect(once).toBe("'=x");
    expect(readGames(toGamesFile([{ id: "a", title: once }])).records[0]!.title).toBe("'=x");
  });
});

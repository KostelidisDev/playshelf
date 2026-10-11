import { describe, expect, it, vi } from "vitest";
import { GameCatalog, remoteThumbnailUrl, thumbnailUrl, parseDate, toVideo, UNMATCHED_GROUP_TITLE, videoUrl, type Video } from "./videos.ts";

const video = (id: string, gameTitle: string, publishedAt: string | null = "2024-01-01T00:00:00Z"): Video => ({
  id,
  title: `Video ${id}`,
  publishedAt: publishedAt ? new Date(publishedAt) : null,
  gameTitle,
});

describe("toVideo", () => {
  it("accepts a valid row", () => {
    expect(toVideo({ video_id: " tW8maoQNthw ", title: "Hi", published_at: "2022-06-20T11:02:29Z", game_title: "Scary Game" })).toEqual({
      id: "tW8maoQNthw",
      title: "Hi",
      publishedAt: new Date("2022-06-20T11:02:29Z"),
      gameTitle: "Scary Game",
    });
  });

  it.each(["", "short", "tW8maoQNthw1", "../../etc/pa", "tW8maoQN/hw", 'tW8"aoQNthw'])("rejects id %j", (id) => {
    expect(toVideo({ video_id: id, title: "x" })).toBeNull();
  });

  it("falls back to the id for a missing title and null for a bad date", () => {
    expect(toVideo({ video_id: "tW8maoQNthw", title: "", published_at: "nope" })).toMatchObject({ title: "tW8maoQNthw", publishedAt: null, gameTitle: "" });
  });

  it("reads a date alone as that day in local time", () => {
    expect(toVideo({ video_id: "tW8maoQNthw", published_at: "2024-06-09" })!.publishedAt).toEqual(new Date(2024, 5, 9));
  });

  it("cleans titles", () => {
    expect(toVideo({ video_id: "tW8maoQNthw", title: "a‮b", game_title: "g\u0007" })).toMatchObject({ title: "a b", gameTitle: "g" });
  });
});

describe("parseDate", () => {
  it("reads dates as local days and timestamps as instants", () => {
    expect(parseDate(" 2024-06-09 ")).toEqual(new Date(2024, 5, 9));
    expect(parseDate("2022-06-20T11:02:29Z")).toEqual(new Date("2022-06-20T11:02:29Z"));
  });

  it.each(["", "nope", "2024-02-30", "2024-13-01"])("rejects %j", (value) => {
    expect(parseDate(value)).toBeNull();
  });
});

describe("URL builders", () => {
  const v = video("tW8maoQNthw", "");
  it("build YouTube and thumbnail URLs", () => {
    expect(videoUrl(v)).toBe("https://www.youtube.com/watch?v=tW8maoQNthw");
    expect(thumbnailUrl(v)).toBe("assets/thumbnails/tW8maoQNthw.webp");
    expect(remoteThumbnailUrl(v)).toBe("https://i.ytimg.com/vi/tW8maoQNthw/hqdefault.jpg");
  });
});

describe("GameCatalog", () => {
  const catalog = new GameCatalog([
    video("aaaaaaaaaa1", "zelda", "2020-01-01T00:00:00Z"),
    video("aaaaaaaaaa2", "Apex", "2021-01-01T00:00:00Z"),
    video("aaaaaaaaaa3", "zelda", "2023-01-01T00:00:00Z"),
    video("aaaaaaaaaa4", "", null),
    video("aaaaaaaaaa5", "Ωμέγα"),
    video("aaaaaaaaaa6", "Élan"),
  ]);

  it("groups by game, sorts by title and puts the unmatched group last", () => {
    expect(catalog.games.map((g) => g.title)).toEqual(["Apex", "Élan", "zelda", "Ωμέγα", UNMATCHED_GROUP_TITLE]);
  });

  it("sorts each game's videos newest first", () => {
    expect(catalog.get("zelda")!.videos.map((v) => v.id)).toEqual(["aaaaaaaaaa3", "aaaaaaaaaa1"]);
  });

  it("looks games up by key", () => {
    expect(catalog.get("")!.title).toBe(UNMATCHED_GROUP_TITLE);
    expect(catalog.get("missing")).toBeNull();
  });

  it("lists letters A-Z then #, without the unmatched group", () => {
    expect(catalog.letters()).toEqual(["A", "E", "Z", "#"]);
  });

  it("filters by accent-insensitive query and letter", () => {
    expect(catalog.filter("elan", null).map((g) => g.key)).toEqual(["Élan"]);
    expect(catalog.filter("  ", "Z").map((g) => g.key)).toEqual(["zelda"]);
    expect(catalog.filter("apex", "Z")).toEqual([]);
    expect(catalog.filter("", null)).toHaveLength(5);
  });

  it("parses CSV text, dropping invalid rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = GameCatalog.fromCsv("﻿video_id,title,published_at,game_title\ntW8maoQNthw,A,2022-06-20T11:02:29Z,G\nbad,B,,G\n");
    expect(parsed.games).toHaveLength(1);
    expect(parsed.get("G")!.videos).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith("Skipped 1 invalid row(s) in videos.csv");
  });

  it("loads over fetch and reports HTTP errors", async () => {
    const ok = vi.fn(async () => new Response("video_id,title,published_at,game_title\ntW8maoQNthw,A,,G\n"));
    expect((await GameCatalog.load("x.csv", ok)).games).toHaveLength(1);
    expect(ok).toHaveBeenCalledWith("x.csv", { cache: "no-cache" });

    const fail = vi.fn(async () => new Response("", { status: 401 }));
    await expect(GameCatalog.load("x.csv", fail)).rejects.toThrow("(401)");
  });
});

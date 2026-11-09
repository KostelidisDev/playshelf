import { describe, expect, it } from "vitest";
import type { GameRecord, VideoRecord } from "./catalog.ts";
import {
  checkGameTitle,
  checkVideo,
  newGameId,
  parseVideoId,
  putGame,
  putVideo,
  removeGame,
  newestVideoByGame,
  removeVideo,
  studioPicture,
  videosOfGame,
} from "./studio.ts";

const ID = "tW8maoQNthw";
const games: GameRecord[] = [{ id: "zelda", title: "Zelda" }, { id: "apex", title: "Apex" }];
const video = (id: string, gameIds: string[]): VideoRecord => ({ id, title: `Video ${id}`, publishedAt: "2024-01-01T00:00:00Z", gameIds });

describe("checkGameTitle", () => {
  it("cleans the title", () => {
    expect(checkGameTitle("  The   Legend\u0007 ")).toEqual({ ok: true, title: "The Legend" });
  });

  it("requires a title and caps its length", () => {
    expect(checkGameTitle("  ")).toEqual({ ok: false, error: "Title is required." });
    expect(checkGameTitle("x".repeat(151))).toEqual({ ok: false, error: "Title is too long (max 150 characters)." });
  });
});

describe("newGameId", () => {
  it("makes a lowercase id from the title, without accents", () => {
    expect(newGameId("Pokémon Scarlet & Violet!", new Set())).toBe("pokemon-scarlet-violet");
    expect(newGameId("  ---  ", new Set())).toBe("game");
  });

  it("adds a number when the id is taken", () => {
    expect(newGameId("Zelda", new Set(["zelda"]))).toBe("zelda-2");
    expect(newGameId("Zelda", new Set(["zelda", "zelda-2"]))).toBe("zelda-3");
  });

  it("keeps the id within 64 characters", () => {
    expect(newGameId("a".repeat(100), new Set()).length).toBeLessThanOrEqual(64);
  });
});

describe("putGame", () => {
  it("adds a new game", () => {
    const result = putGame(games, { id: "elden", title: "Elden Ring" }, null);
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.games.map((g) => g.id)).toEqual(["zelda", "apex", "elden"]);
  });

  it("renames a game, keeping its id", () => {
    const result = putGame(games, { id: "zelda", title: "The Legend of Zelda" }, "zelda");
    expect(result.ok && result.games[0]).toEqual({ id: "zelda", title: "The Legend of Zelda" });
  });

  it("refuses a title another game has, ignoring case", () => {
    expect(putGame(games, { id: "x", title: "APEX" }, null)).toEqual({ ok: false, error: "There is already a game called “APEX”." });
  });

  it("allows a game to keep its own title", () => {
    expect(putGame(games, { id: "zelda", title: "Zelda" }, "zelda").ok).toBe(true);
  });
});

describe("removeGame", () => {
  it("takes the game off its videos, and removes videos left with no game", () => {
    const videos = [video("aaaaaaaaaa1", ["zelda"]), video("aaaaaaaaaa2", ["zelda", "apex"])];
    const result = removeGame(games, videos, "zelda");
    expect(result.games.map((g) => g.id)).toEqual(["apex"]);
    expect(result.videos.map((v) => [v.id, v.gameIds])).toEqual([["aaaaaaaaaa2", ["apex"]]]);
    expect(result.removedVideos.map((v) => v.id)).toEqual(["aaaaaaaaaa1"]);
  });

  it("leaves videos on other games alone", () => {
    const videos = [video("aaaaaaaaaa1", ["apex"])];
    expect(removeGame(games, videos, "zelda").videos).toEqual(videos);
  });
});

describe("videosOfGame", () => {
  it("lists the videos on a game", () => {
    expect(videosOfGame([video("aaaaaaaaaa1", ["zelda"]), video("aaaaaaaaaa2", ["apex"])], "apex").map((v) => v.id)).toEqual(["aaaaaaaaaa2"]);
  });
});

describe("parseVideoId", () => {
  it.each([
    [ID, ID],
    [` ${ID} `, ID],
    [`https://www.youtube.com/watch?v=${ID}&t=5`, ID],
    [`https://youtu.be/${ID}`, ID],
    ["https://m.youtube.com/shorts/" + ID, ID],
    ["tW8maoQNthw1", null],
    ["https://example.com/watch?v=" + ID, null],
  ])("reads %j", (input, expected) => {
    expect(parseVideoId(input)).toBe(expected);
  });
});

describe("checkVideo", () => {
  const draft = { id: ID, title: "Trailer, the one", publishedAt: "2024-05-09T10:30:30+02:00", gameIds: ["zelda"] };

  it("checks and normalises a valid video", () => {
    expect(checkVideo(draft, games)).toEqual({
      ok: true,
      record: { id: ID, title: "Trailer, the one", publishedAt: "2024-05-09T08:30:30Z", gameIds: ["zelda"] },
    });
  });

  it("reports each bad field", () => {
    const result = checkVideo({ id: "nope", title: " ", publishedAt: "2024-13-01", gameIds: [] }, games);
    expect(result).toEqual({
      ok: false,
      errors: {
        id: "Video ID must be an 11-character YouTube id or a YouTube video URL.",
        title: "Title is required.",
        publishedAt: "'2024-13-01' isn't a valid date, e.g. 2024-05-09T10:30:30Z.",
        gameIds: "Choose at least one game.",
      },
    });
  });

  it("needs a date", () => {
    expect(checkVideo({ ...draft, publishedAt: "" }, games)).toMatchObject({ ok: false, errors: { publishedAt: "Published date is required." } });
  });

  it("only keeps games that exist, and needs one that does", () => {
    expect(checkVideo({ ...draft, gameIds: ["zelda", "zelda", "gone"] }, games)).toMatchObject({ ok: true, record: { gameIds: ["zelda"] } });
    expect(checkVideo({ ...draft, gameIds: ["gone"] }, games)).toMatchObject({ ok: false, errors: { gameIds: "Choose at least one game." } });
  });

  it("caps the title length", () => {
    expect(checkVideo({ ...draft, title: "x".repeat(201) }, games)).toMatchObject({ ok: false, errors: { title: "Title is too long (max 200 characters)." } });
  });
});

describe("putVideo and removeVideo", () => {
  it("adds, replaces and refuses a repeated id", () => {
    const videos = [video(ID, ["zelda"])];
    expect(putVideo(videos, video("bbbbbbbbbbb", ["apex"]), null)).toMatchObject({ ok: true });
    expect(putVideo(videos, video(ID, ["apex"]), null)).toEqual({ ok: false, errors: { id: "That video is already in the list." } });
    const replaced = putVideo(videos, video(ID, ["apex"]), ID);
    expect(replaced.ok && replaced.videos[0]!.gameIds).toEqual(["apex"]);
  });

  it("removes a video by id", () => {
    expect(removeVideo([video(ID, ["zelda"])], ID)).toEqual([]);
  });
});

describe("newestVideoByGame", () => {
  it("picks each game's newest video by publish date, whatever the order", () => {
    const old: VideoRecord = { ...video("old", ["zelda"]), publishedAt: "2020-01-01T00:00:00Z" };
    const fresh: VideoRecord = { ...video("fresh", ["zelda", "apex"]), publishedAt: "2024-01-01T00:00:00Z" };
    const newest = newestVideoByGame([fresh, old]);
    expect(newest.get("zelda")?.id).toBe("fresh");
    expect(newest.get("apex")?.id).toBe("fresh");
    expect(newest.has("empty")).toBe(false);
  });
});

describe("studioPicture", () => {
  it("steps up out of /studio/ for the site's pictures, and leaves remote ones", () => {
    expect(studioPicture("assets/thumbnails/games/zelda.webp")).toBe("../assets/thumbnails/games/zelda.webp");
    expect(studioPicture("https://i.ytimg.com/vi/x/hqdefault.jpg")).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg");
  });
});

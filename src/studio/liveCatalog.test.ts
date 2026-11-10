import { describe, expect, it, vi } from "vitest";
import { fetchLiveCatalog } from "./liveCatalog.ts";

const BASE = "https://games.example.com/studio/";

/** A fetch that answers from a table of paths; each call is recorded. */
function fakeFetch(answers: Record<string, string | number>) {
  return vi.fn(async (url: URL | RequestInfo, _init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const answer = answers[path];
    if (answer === undefined) return new Response("", { status: 404 });
    return typeof answer === "number" ? new Response("", { status: answer }) : new Response(answer, { status: 200 });
  });
}

describe("fetchLiveCatalog", () => {
  it("reads both files from the site's folder, past the browser's cache", async () => {
    const fetcher = fakeFetch({ "/assets/api/Games.txt": "games", "/assets/api/Videos.txt": "videos" });
    const result = await fetchLiveCatalog(BASE, fetcher);
    expect(result).toEqual({ ok: true, files: { games: "games", videos: "videos" } });
    expect(fetcher.mock.calls.map(([url]) => String(url)).sort()).toEqual([
      "https://games.example.com/assets/api/Games.txt",
      "https://games.example.com/assets/api/Videos.txt",
    ]);
    for (const [, init] of fetcher.mock.calls) expect(init).toEqual({ cache: "no-store" });
  });

  it("says which file the site refused", async () => {
    const fetcher = fakeFetch({ "/assets/api/Games.txt": "games", "/assets/api/Videos.txt": 503 });
    expect(await fetchLiveCatalog(BASE, fetcher)).toEqual({ ok: false, error: "The site answered 503 for Videos.txt." });
  });

  it("says the site couldn't be reached when the request fails", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    expect(await fetchLiveCatalog(BASE, fetcher)).toEqual({ ok: false, error: "The site couldn't be reached." });
  });
});

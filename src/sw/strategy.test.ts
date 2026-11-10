import { describe, expect, it } from "vitest";
import { cacheable, cacheKey, staleCaches, strategyFor, studioStrategyFor } from "./strategy.ts";

const origin = "https://site.test";
const get = (path: string, mode = "cors") => ({ method: "GET", mode, url: `${origin}${path}` });

describe("strategyFor", () => {
  it("serves every navigation from the app shell", () => {
    expect(strategyFor(get("/", "navigate"), origin)).toEqual({ kind: "navigate" });
    expect(strategyFor(get("/?g=x", "navigate"), origin)).toEqual({ kind: "navigate" });
  });

  it("serves thumbnails cache-first and everything else network-first", () => {
    expect(strategyFor(get("/assets/thumbnails/tW8maoQNthw.webp"), origin)).toEqual({ kind: "cache-first" });
    expect(strategyFor(get("/assets/api/Videos.txt"), origin)).toEqual({ kind: "network-first" });
  });

  it("leaves the catalog editor to the network, rather than the app shell", () => {
    expect(strategyFor(get("/studio/", "navigate"), origin)).toEqual({ kind: "ignore" });
    expect(strategyFor(get("/studio/?x=1", "navigate"), origin)).toEqual({ kind: "ignore" });
    expect(strategyFor(get("/studio/assets/app/index-abc.js"), origin)).toEqual({ kind: "ignore" });
  });

  it("ignores other origins and non-GET requests", () => {
    expect(strategyFor({ method: "GET", mode: "no-cors", url: "https://i.ytimg.com/vi/x/hqdefault.jpg" }, origin)).toEqual({ kind: "ignore" });
    expect(strategyFor({ ...get("/"), method: "POST" }, origin)).toEqual({ kind: "ignore" });
  });
});

describe("cacheKey", () => {
  it("drops query and hash, and maps index.html to ./", () => {
    expect(cacheKey(`${origin}/sub/?g=x#y`)).toBe(`${origin}/sub/`);
    expect(cacheKey(`${origin}/sub/index.html?q=a`)).toBe(`${origin}/sub/`);
    expect(cacheKey(`${origin}/assets/app/index-abc.js`)).toBe(`${origin}/assets/app/index-abc.js`);
  });
});

describe("cacheable", () => {
  const ok = { ok: true, status: 200, type: "basic" as ResponseType, redirected: false };
  it("accepts only complete same-origin 200s", () => {
    expect(cacheable(ok)).toBe(true);
    expect(cacheable({ ...ok, ok: false, status: 401 })).toBe(false);
    expect(cacheable({ ...ok, status: 206 })).toBe(false);
    expect(cacheable({ ...ok, type: "opaque" })).toBe(false);
    expect(cacheable({ ...ok, redirected: true })).toBe(false);
  });
});

describe("studioStrategyFor", () => {
  const scope = `${origin}/studio/`;

  it("answers the editor's pages from its own shell, with navigations from the page", () => {
    expect(studioStrategyFor(get("/studio/", "navigate"), scope)).toEqual({ kind: "navigate" });
    expect(studioStrategyFor(get("/studio/?x=1", "navigate"), scope)).toEqual({ kind: "navigate" });
    expect(studioStrategyFor(get("/studio/manifest.webmanifest"), scope)).toEqual({ kind: "network-first" });
  });

  it("caches the hashed app files and icons the editor loads, and nothing else", () => {
    expect(studioStrategyFor(get("/assets/app/studio-abc.js"), scope)).toEqual({ kind: "cache-first" });
    expect(studioStrategyFor(get("/assets/icons/icon-192.png"), scope)).toEqual({ kind: "cache-first" });
    // The catalog is opened from disk in the page, never fetched, and the site's thumbnails stay with the site's worker.
    expect(studioStrategyFor(get("/assets/api/Games.txt"), scope)).toEqual({ kind: "ignore" });
    expect(studioStrategyFor(get("/assets/thumbnails/tW8maoQNthw.webp"), scope)).toEqual({ kind: "ignore" });
  });

  it("ignores other origins and non-GET requests", () => {
    expect(studioStrategyFor({ method: "GET", mode: "no-cors", url: "https://i.ytimg.com/vi/x/hqdefault.jpg" }, scope)).toEqual({ kind: "ignore" });
    expect(studioStrategyFor({ ...get("/studio/"), method: "POST" }, scope)).toEqual({ kind: "ignore" });
  });
});

describe("staleCaches", () => {
  const keys = ["shell-v1", "thumbnails-v1", "shell-v0", "studio-shell-v1", "studio-shell-v0"];

  it("lets the site's worker clear only the site's old caches", () => {
    expect(staleCaches(keys, new Set(["shell-v1", "thumbnails-v1"]), "site")).toEqual(["shell-v0"]);
  });

  it("lets the editor's worker clear only its own old caches", () => {
    expect(staleCaches(keys, new Set(["studio-shell-v1"]), "studio")).toEqual(["studio-shell-v0"]);
  });
});

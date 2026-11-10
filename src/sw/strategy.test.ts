import { describe, expect, it } from "vitest";
import { cacheable, cacheKey, strategyFor } from "./strategy.ts";

const origin = "https://site.test";
const get = (path: string, mode = "cors") => ({ method: "GET", mode, url: `${origin}${path}` });

describe("strategyFor", () => {
  it("serves every navigation from the app shell", () => {
    expect(strategyFor(get("/", "navigate"), origin)).toEqual({ kind: "navigate" });
    expect(strategyFor(get("/?g=x", "navigate"), origin)).toEqual({ kind: "navigate" });
  });

  it("serves thumbnails cache-first and everything else network-first", () => {
    expect(strategyFor(get("/assets/thumbnails/tW8maoQNthw.webp"), origin)).toEqual({ kind: "cache-first" });
    expect(strategyFor(get("/assets/api/videos.csv"), origin)).toEqual({ kind: "network-first" });
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

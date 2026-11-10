import { describe, expect, it } from "vitest";
import { gameUrl, homeUrl, parseRoute } from "./routes.ts";

describe("parseRoute", () => {
  it("defaults to the unfiltered home grid", () => {
    expect(parseRoute("")).toEqual({ gameKey: null, query: "", letter: null, page: 1 });
  });

  it("reads the game, query, letter and page", () => {
    expect(parseRoute("?g=Clair Obscur: Expedition 33&q=dec&l=D&p=3")).toEqual({ gameKey: "Clair Obscur: Expedition 33", query: "dec", letter: "D", page: 3 });
  });

  it("keeps an empty game key (the unmatched group)", () => {
    expect(parseRoute("?g=").gameKey).toBe("");
  });

  it.each(["?l=dd", "?l=d", "?l=%3Cscript%3E"])("ignores an invalid letter: %s", (search) => {
    expect(parseRoute(search).letter).toBeNull();
  });

  it("accepts # as a letter", () => {
    expect(parseRoute("?l=%23").letter).toBe("#");
  });

  it.each(["?p=0", "?p=-1", "?p=abc", "?p=1e3", "?p=999999"])("falls back to page 1: %s", (search) => {
    expect(parseRoute(search).page).toBe(1);
  });

  it("caps the query length", () => {
    expect(parseRoute(`?q=${"a".repeat(500)}`).query).toHaveLength(200);
  });
});

describe("URL builders", () => {
  it("omits defaults", () => {
    expect(homeUrl()).toBe("./");
    expect(homeUrl({ query: "", letter: null, page: 1 })).toBe("./");
    expect(gameUrl("Clair Obscur: Expedition 33")).toBe("./?g=Clair+Obscur%3A+Expedition+33");
  });

  it("encodes values and round-trips through parseRoute", () => {
    const url = homeUrl({ query: "a&b=c", letter: "#", page: 2 });
    expect(parseRoute(url.slice(2))).toEqual({ gameKey: null, query: "a&b=c", letter: "#", page: 2 });
    expect(parseRoute(gameUrl("Tom & Jerry", 4).slice(2))).toMatchObject({ gameKey: "Tom & Jerry", page: 4 });
  });
});

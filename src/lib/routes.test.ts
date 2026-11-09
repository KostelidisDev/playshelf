import { describe, expect, it } from "vitest";
import { gameUrl, homeUrl, parseRoute } from "./routes.ts";

describe("parseRoute", () => {
  it("defaults to the unfiltered home grid", () => {
    expect(parseRoute("")).toEqual({ gameId: null, query: "", letter: null, page: 1 });
  });

  it("reads the game, query, letter and page", () => {
    expect(parseRoute("?g=clair-obscur-expedition-33&q=dec&l=D&p=3")).toEqual({ gameId: "clair-obscur-expedition-33", query: "dec", letter: "D", page: 3 });
  });

  it("keeps an empty game id, which no game has", () => {
    expect(parseRoute("?g=").gameId).toBe("");
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
    expect(gameUrl("clair-obscur-expedition-33")).toBe("./?g=clair-obscur-expedition-33");
  });

  it("encodes values and round-trips through parseRoute", () => {
    const url = homeUrl({ query: "a&b=c", letter: "#", page: 2 });
    expect(parseRoute(url.slice(2))).toEqual({ gameId: null, query: "a&b=c", letter: "#", page: 2 });
    expect(parseRoute(gameUrl("tom-and-jerry", 4).slice(2))).toMatchObject({ gameId: "tom-and-jerry", page: 4 });
  });
});

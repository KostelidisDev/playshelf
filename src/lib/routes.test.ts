import { describe, expect, it } from "vitest";
import { gameUrl, homeUrl, isSafeHref, parseRoute } from "./routes.ts";

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

describe("isSafeHref", () => {
  it("allows the app's own relative addresses and http(s) ones", () => {
    expect(isSafeHref("./?g=abc")).toBe(true);
    expect(isSafeHref("./")).toBe(true);
    expect(isSafeHref("assets/thumbnails/x.webp")).toBe(true);
    expect(isSafeHref("https://www.youtube.com/watch?v=abcdefghijk")).toBe(true);
    expect(isSafeHref("HTTPS://kostelidis.dev")).toBe(true);
  });

  it("refuses script and other schemes, and protocol-relative addresses", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>x</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox")).toBe(false);
    expect(isSafeHref("//evil.example/x")).toBe(false);
    expect(isSafeHref("/\\evil.example/x")).toBe(false);
    expect(isSafeHref("java\tscript:alert(1)")).toBe(false);
    expect(isSafeHref(" javascript:alert(1)")).toBe(false);
  });
});

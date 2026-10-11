import { describe, expect, it } from "vitest";
import { parseCSV } from "./csv.ts";

describe("parseCSV", () => {
  it("parses rows keyed by the header", () => {
    expect(parseCSV("a,b\n1,2\n3,4\n")).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(Object.keys(parseCSV("﻿video_id,title\nx,y")[0]!)).toEqual(["video_id", "title"]);
  });

  it("handles quotes, escaped quotes, commas and newlines in fields", () => {
    expect(parseCSV('a,b\n"x, y","say ""hi""\nthere"')).toEqual([{ a: "x, y", b: 'say "hi"\nthere' }]);
  });

  it("handles CRLF and skips blank lines", () => {
    expect(parseCSV("a,b\r\n1,2\r\n\r\n3,4")).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });

  it("fills missing cells with empty strings", () => {
    expect(parseCSV("a,b,c\n1,2")).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("can't pollute Object.prototype through a __proto__ column", () => {
    const [row] = parseCSV("__proto__,b\nevil,1");
    expect(row!["__proto__"]).toBe("evil");
    expect(({} as Record<string, unknown>).b).toBeUndefined();
  });

  it("returns nothing for empty input", () => {
    expect(parseCSV("")).toEqual([]);
  });
});

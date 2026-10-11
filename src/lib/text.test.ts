import { describe, expect, it } from "vitest";
import { cleanText, firstLetter, normalizeText, plural } from "./text.ts";

describe("normalizeText", () => {
  it("lowercases and strips accents, Latin and Greek", () => {
    expect(normalizeText("Pokémon")).toBe("pokemon");
    expect(normalizeText("Αμνησία")).toBe("αμνησια");
  });
});

describe("firstLetter", () => {
  it.each([
    ["apex", "A"],
    ["Élden Ring", "E"],
    ["  zelda", "Z"],
    ["7 Days", "#"],
    ["Ωμέγα", "#"],
  ])("%s -> %s", (title, letter) => {
    expect(firstLetter(title)).toBe(letter);
  });

  it("is null for an empty title", () => {
    expect(firstLetter("")).toBeNull();
  });
});

describe("cleanText", () => {
  it("removes control and bidi-override characters and collapses spaces", () => {
    expect(cleanText("a\u0000b‮c\n\td  e")).toBe("a b c d e");
  });

  it("caps the length", () => {
    expect(cleanText("x".repeat(500))).toHaveLength(300);
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("turns null and undefined into empty strings", () => {
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(null)).toBe("");
  });
});

describe("plural", () => {
  it("adds an s except for one", () => {
    expect(plural(0, "game")).toBe("0 games");
    expect(plural(1, "game")).toBe("1 game");
    expect(plural(2, "video")).toBe("2 videos");
  });
});

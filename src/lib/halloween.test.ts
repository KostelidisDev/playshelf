import { describe, expect, it } from "vitest";
import { isHalloween, nextSpell } from "./halloween.ts";

describe("isHalloween", () => {
  it("is true on October 31 only, in local time", () => {
    expect(isHalloween(new Date(2026, 9, 31, 0, 0))).toBe(true);
    expect(isHalloween(new Date(2026, 9, 31, 23, 59))).toBe(true);
    expect(isHalloween(new Date(2026, 9, 30, 23, 59))).toBe(false);
    expect(isHalloween(new Date(2026, 10, 1))).toBe(false);
  });
});

describe("nextSpell", () => {
  const type = (keys: string[]) => keys.reduce((typed, key) => nextSpell(typed, key), "");

  it("completes the spell, in any case", () => {
    expect(type(["b", "o", "o"])).toBe("boo");
    expect(type(["B", "O", "O"])).toBe("boo");
  });

  it("starts over on a wrong key, keeping a fresh start", () => {
    expect(type(["b", "o", "x"])).toBe("");
    expect(type(["b", "b", "o", "o"])).toBe("boo");
    expect(type(["b", "o", "b", "o", "o"])).toBe("boo");
  });

  it("starts over on any other key, such as Shift", () => {
    expect(type(["b", "Shift", "o", "o"])).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { isPlainClick, isShortcutKey } from "./events.ts";

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("isPlainClick", () => {
  it("is true only for an unmodified left click", () => {
    expect(isPlainClick(click)).toBe(true);
    expect(isPlainClick({ ...click, button: 1 })).toBe(false);
    expect(isPlainClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...click, shiftKey: true })).toBe(false);
  });
});

describe("isShortcutKey", () => {
  const key = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: document.body };
  it("ignores modified keys and keys typed into fields", () => {
    expect(isShortcutKey(key)).toBe(true);
    expect(isShortcutKey({ ...key, ctrlKey: true })).toBe(false);
    expect(isShortcutKey({ ...key, target: document.createElement("input") })).toBe(false);
  });
});

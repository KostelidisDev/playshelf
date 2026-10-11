import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useScrolledFlag } from "./useScrolledFlag.ts";

describe("useScrolledFlag", () => {
  it("sets data-scrolled on <html> only once the page has scrolled", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 0; }); // runs now, nothing pending
    const root = document.documentElement;
    const setScroll = (y: number) => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    };

    const { unmount } = renderHook(() => useScrolledFlag());
    expect(root.hasAttribute("data-scrolled")).toBe(false);
    setScroll(100);
    expect(root.hasAttribute("data-scrolled")).toBe(true);
    setScroll(0);
    expect(root.hasAttribute("data-scrolled")).toBe(false);
    unmount();
  });
});

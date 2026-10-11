import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no layout and lacks these browser APIs. Stubs let components
// mount; tests that need more replace them with their own spies.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// Tests in the node environment (build/) have no DOM to set up.
if (typeof window !== "undefined") {
  globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
  // jsdom has no canvas; without one, the tint sampler skips tinting.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    document.documentElement.removeAttribute("data-scrolled");
  });
}

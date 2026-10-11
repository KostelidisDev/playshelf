import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryRouter, readHistoryState } from "./history.ts";

describe("readHistoryState", () => {
  it("keeps only well-typed fields", () => {
    expect(readHistoryState({ fromHome: 2, scrollY: 120.5, other: "x" })).toEqual({ fromHome: 2, scrollY: 120.5 });
    expect(readHistoryState({ fromHome: "2", scrollY: -1 })).toEqual({});
    expect(readHistoryState({ fromHome: 1.5, scrollY: Infinity })).toEqual({});
    expect(readHistoryState(null)).toEqual({});
    expect(readHistoryState("junk")).toEqual({});
  });
});

describe("HistoryRouter", () => {
  let router: HistoryRouter;
  afterEach(() => router.dispose());

  it("pushes and replaces, notifying subscribers with the cause", () => {
    router = new HistoryRouter();
    const listener = vi.fn();
    router.subscribe(listener);
    expect(router.getSnapshot()).toEqual({ search: "", cause: "initial" });

    router.push("./?g=x", { fromHome: 1 });
    expect(router.getSnapshot()).toEqual({ search: "?g=x", cause: "push" });
    expect(router.state).toEqual({ fromHome: 1 });

    router.replace("./?g=y", { scrollY: 5 });
    expect(router.getSnapshot()).toEqual({ search: "?g=y", cause: "replace" });
    expect(router.state).toEqual({ fromHome: 1, scrollY: 5 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("saves the scroll position without notifying", () => {
    router = new HistoryRouter();
    const listener = vi.fn();
    router.subscribe(listener);
    Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
    router.saveScroll();
    expect(router.state.scrollY).toBe(300);
    expect(listener).not.toHaveBeenCalled();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("reports back/forward as pop", () => {
    router = new HistoryRouter();
    const listener = vi.fn();
    router.subscribe(listener);
    window.history.pushState(null, "", "/?q=a");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(router.getSnapshot()).toEqual({ search: "?q=a", cause: "pop" });
    expect(listener).toHaveBeenCalledOnce();
  });
});

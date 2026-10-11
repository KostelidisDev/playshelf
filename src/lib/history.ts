/* The browser history as an external store for React's
 * useSyncExternalStore. Navigating with the History API keeps the grid's
 * filters, page and scroll position across Back and Forward, without
 * reloading the page or the catalog. */

/** What the app stores in history.state. */
export interface HistoryState {
  /** On a game's pages: how many history entries back the grid is. */
  fromHome?: number;
  /** The grid's scroll position, restored on returning to it. */
  scrollY?: number;
}

/** Why the location changed, which decides where the page scrolls. */
export type NavigationCause = "initial" | "push" | "replace" | "pop";

export interface HistoryLocation {
  readonly search: string;
  readonly cause: NavigationCause;
}

const nonNegativeInt = (value: unknown): number | undefined =>
  Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : undefined;

/** history.state survives reloads and may hold anything, so only the
 * expected fields, with the expected types, are kept. */
export function readHistoryState(raw: unknown): HistoryState {
  if (!raw || typeof raw !== "object") return {};
  const { fromHome, scrollY } = raw as Record<string, unknown>;
  const state: HistoryState = {};
  const steps = nonNegativeInt(fromHome);
  const y = typeof scrollY === "number" && Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : undefined;
  if (steps) state.fromHome = steps;
  if (y !== undefined) state.scrollY = y;
  return state;
}

export class HistoryRouter {
  private snapshot: HistoryLocation;
  private readonly listeners = new Set<() => void>();
  private readonly onPopState = () => this.update("pop");

  constructor(private readonly win: Window = window) {
    if ("scrollRestoration" in win.history) win.history.scrollRestoration = "manual";
    this.snapshot = { search: win.location.search, cause: "initial" };
    win.addEventListener("popstate", this.onPopState);
  }

  dispose(): void {
    this.win.removeEventListener("popstate", this.onPopState);
    this.listeners.clear();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): HistoryLocation => this.snapshot;

  get state(): HistoryState {
    return readHistoryState(this.win.history.state);
  }

  push(url: string, state: HistoryState | null = null): void {
    this.win.history.pushState(state, "", url);
    this.update("push");
  }

  replace(url: string, changes: HistoryState = {}): void {
    this.win.history.replaceState({ ...this.state, ...changes }, "", url);
    this.update("replace");
  }

  /** Stores the scroll position in the current history entry, so returning
   * from a game page lands where the user left off. */
  saveScroll(): void {
    this.win.history.replaceState({ ...this.state, scrollY: this.win.scrollY }, "");
  }

  go(delta: number): void {
    this.win.history.go(delta);
  }

  private update(cause: NavigationCause): void {
    this.snapshot = { search: this.win.location.search, cause };
    for (const listener of this.listeners) listener();
  }
}

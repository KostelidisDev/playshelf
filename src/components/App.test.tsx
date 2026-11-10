import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryRouter } from "../lib/history.ts";
import type { GameCatalog } from "../lib/videos.ts";
import { makeCatalog, makeVideo } from "../test/fixtures.ts";
import { App } from "./App.tsx";

let router: HistoryRouter | null = null;
afterEach(() => {
  router?.dispose();
  router = null;
});

async function renderApp(catalog: GameCatalog | (() => Promise<GameCatalog>), url = "/") {
  window.history.replaceState(null, "", url);
  router = new HistoryRouter();
  const load = typeof catalog === "function" ? catalog : () => Promise.resolve(catalog);
  const user = userEvent.setup();
  const view = render(<App router={router} loadCatalog={load} />);
  return { user, router, ...view };
}

const cardTitles = () => [...document.querySelectorAll(".card-title")].map((el) => el.textContent);
const status = () => screen.getByRole("status").textContent;

describe("App: home view", () => {
  it("shows skeletons while loading, then the first page of games", async () => {
    let resolve!: (catalog: GameCatalog) => void;
    await renderApp(() => new Promise((r) => { resolve = r; }));
    expect(status()).toBe("Loading…");
    expect(document.querySelectorAll(".card.skeleton")).toHaveLength(16);

    await act(async () => resolve(makeCatalog(20)));
    expect(cardTitles()).toHaveLength(16);
    expect(cardTitles()[0]).toBe("Game 01");
    expect(status()).toBe("20 games");
    expect(screen.getByText("1–16 of 20")).toBeInTheDocument();
    expect(document.title).toBe("PlayShelf");
  });

  it("filters by search, accent-insensitively, and writes it to the URL", async () => {
    const { user } = await renderApp(makeCatalog(3, [makeVideo("Pokémon")]));
    await screen.findByText("Pokémon");
    await user.type(screen.getByRole("searchbox", { name: "Search games" }), "pokemon");
    expect(cardTitles()).toEqual(["Pokémon"]);
    expect(status()).toBe("1 of 4 games");
    expect(window.location.search).toBe("?q=pokemon");
  });

  it("restores filters and page from the URL", async () => {
    await renderApp(makeCatalog(40), "/?q=game&p=2");
    await screen.findByText("Game 17");
    expect(screen.getByRole("searchbox")).toHaveValue("game");
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });

  it("filters by letter, toggling it off again", async () => {
    const { user } = await renderApp(makeCatalog(2, [makeVideo("Apex"), makeVideo("Zelda")]));
    await screen.findByText("Apex");
    const letters = screen.getByRole("navigation", { name: "Filter games by first letter" });
    await user.click(within(letters).getByRole("button", { name: "Z" }));
    expect(cardTitles()).toEqual(["Zelda"]);
    expect(within(letters).getByRole("button", { name: "Z" })).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toBe("?l=Z");

    await user.click(within(letters).getByRole("button", { name: "Z" }));
    expect(cardTitles()).toHaveLength(4);
    expect(window.location.search).toBe("");
  });

  it("shows a message with a way out when nothing matches", async () => {
    const { user } = await renderApp(makeCatalog(3));
    await screen.findByText("Game 01");
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No games match “zzz”.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cardTitles()).toHaveLength(3);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("says so when the catalog has no games", async () => {
    await renderApp(makeCatalog(0));
    expect(await screen.findByText("There are no games yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("Escape clears the search, and / focuses it", async () => {
    const { user } = await renderApp(makeCatalog(3), "/?q=game 01");
    await screen.findByText("Game 01");
    const search = screen.getByRole("searchbox");
    await user.click(search);
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");

    search.blur();
    await user.keyboard("/");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("pages with the page bar and the arrow keys, each in its own history entry", async () => {
    const { user } = await renderApp(makeCatalog(40));
    await screen.findByText("Game 01");
    await user.click(screen.getByRole("link", { name: "Next page" }));
    expect(window.location.search).toBe("?p=2");
    expect(cardTitles()[0]).toBe("Game 17");

    await user.keyboard("{ArrowRight}");
    expect(window.location.search).toBe("?p=3");
    expect(cardTitles()).toHaveLength(8);
    expect(screen.getByLabelText("Next page")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{ArrowRight}");
    expect(window.location.search).toBe("?p=3");

    await user.keyboard("{ArrowLeft}");
    expect(window.location.search).toBe("?p=2");
    expect(window.history.length).toBeGreaterThanOrEqual(3);
  });

  it("a new search starts again at page 1", async () => {
    const { user } = await renderApp(makeCatalog(40), "/?p=3");
    await screen.findByText("Game 33");
    await user.type(screen.getByRole("searchbox"), "1");
    expect(window.location.search).toBe("?q=1");
  });

  it("shows an error with a retry button when loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeCatalog(1));
    const { user } = await renderApp(load);
    expect(await screen.findByText("Couldn't load the games. Please try again.")).toBeInTheDocument();
    expect(status()).toBe("");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Game 01")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("App: game view", () => {
  it("opens a game from its card, newest video first, and goes back to the grid", async () => {
    const backSpy = vi.spyOn(window.history, "go");
    const catalog = makeCatalog(2, [
      makeVideo("Clair Obscur: Expedition 33", { title: "Older", publishedAt: new Date("2020-01-01T00:00:00Z") }),
      makeVideo("Clair Obscur: Expedition 33", { title: "Newer", publishedAt: new Date("2024-01-01T00:00:00Z") }),
    ]);
    const { user } = await renderApp(catalog);
    await user.click(await screen.findByRole("link", { name: /Clair Obscur: Expedition 33/ }));

    expect(window.location.search).toBe("?g=Clair+Obscur%3A+Expedition+33");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Clair Obscur: Expedition 33");
    expect(cardTitles()).toEqual(["Newer", "Older"]);
    expect(status()).toBe("2 videos");
    expect(document.title).toBe("Clair Obscur: Expedition 33 — PlayShelf");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    const videoLink = screen.getByRole("link", { name: /Newer/ });
    expect(videoLink).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.youtube\.com\/watch\?v=/));
    expect(videoLink).toHaveAttribute("target", "_blank");
    expect(videoLink).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(screen.getByRole("link", { name: "Back to all games" }));
    expect(backSpy).toHaveBeenCalledWith(-1);
  });

  it("counts page changes so the back arrow returns straight to the grid", async () => {
    const backSpy = vi.spyOn(window.history, "go");
    const videos = Array.from({ length: 20 }, () => makeVideo("Long"));
    const { user } = await renderApp(makeCatalog(1, videos));
    await user.click(await screen.findByRole("link", { name: /Long/ }));
    await user.click(screen.getByRole("link", { name: "Page 2" }));
    expect(window.location.search).toBe("?g=Long&p=2");
    expect(cardTitles()).toHaveLength(4);
    await user.click(screen.getByRole("link", { name: "Back to all games" }));
    expect(backSpy).toHaveBeenCalledWith(-2);
  });

  it("opened directly, the back arrow goes to the home grid", async () => {
    const { user } = await renderApp(makeCatalog(2), "/?g=Game 02");
    await screen.findByRole("heading", { name: "Game 02" });
    await user.click(screen.getByRole("link", { name: "Back to all games" }));
    expect(window.location.search).toBe("");
    expect(cardTitles()).toHaveLength(2);
  });

  it("shows a message for an unknown game", async () => {
    const { user } = await renderApp(makeCatalog(2), "/?g=Nope");
    expect(await screen.findByRole("heading", { name: "Game not found" })).toBeInTheDocument();
    expect(screen.getByText("There are no videos for this game.")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "All games" }));
    expect(cardTitles()).toHaveLength(2);
  });

  it("restores the grid's scroll position on back", async () => {
    const { user } = await renderApp(makeCatalog(3));
    Object.defineProperty(window, "scrollY", { value: 420, configurable: true });
    await user.click(await screen.findByRole("link", { name: /Game 02/ }));
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    vi.mocked(window.scrollTo).mockClear();
    await act(async () => {
      window.history.back();
      await new Promise((r) => window.addEventListener("popstate", r, { once: true }));
    });
    expect(window.location.search).toBe("");
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 420);
  });
});

describe("App: never renders data as HTML", () => {
  it("shows markup in titles as text", async () => {
    await renderApp(makeCatalog(0, [makeVideo("<img src=x onerror=alert(1)>")]));
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});

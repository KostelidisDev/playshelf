/* The app: loads the catalog, shows the home or game view for the URL, and
 * owns the page-level state (status line, document title, scroll). */

import { useCallback, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { useCatalog, type CatalogLoader } from "../hooks/useCatalog.ts";
import { useScrolledFlag } from "../hooks/useScrolledFlag.ts";
import type { HistoryRouter } from "../lib/history.ts";
import { paginate } from "../lib/pagination.ts";
import { homeUrl, parseRoute, type RouteState } from "../lib/routes.ts";
import { plural } from "../lib/text.ts";
import type { GameCatalog } from "../lib/videos.ts";
import { AppBar, BRAND } from "./AppBar.tsx";
import { Footer } from "./Footer.tsx";
import { GameView } from "./GameView.tsx";
import { Halloween } from "./Halloween.tsx";
import { HomeView } from "./HomeView.tsx";
import { LetterStrip } from "./LetterStrip.tsx";
import { Message } from "./Message.tsx";
import { LoadingGrid } from "./PagedGrid.tsx";
import { SearchBox } from "./SearchBox.tsx";

interface Props {
  router: HistoryRouter;
  loadCatalog?: CatalogLoader;
}

export function App({ router, loadCatalog }: Props) {
  const location = useSyncExternalStore(router.subscribe, router.getSnapshot);
  const route = useMemo(() => parseRoute(location.search), [location.search]);
  const [catalogState, retry] = useCatalog(loadCatalog);
  const catalog = catalogState.status === "ready" ? catalogState.catalog : null;
  const view = route.gameKey === null ? "home" : "game";
  useScrolledFlag();

  // ---------- Navigation ----------

  /** Each page change is a history entry, so Back returns to the page
   * before. On a game's pages, `fromHome` counts the entries back to the
   * grid, so the back arrow can jump straight there. */
  const goToPage = useCallback((url: string) => {
    const steps = router.state.fromHome;
    router.push(url, steps ? { fromHome: steps + 1 } : null);
  }, [router]);

  const openGame = useCallback((url: string) => {
    router.saveScroll();
    router.push(url, { fromHome: 1 });
  }, [router]);

  const goHome = useCallback((url: string) => router.push(url), [router]);

  /** A new search or letter replaces the current history entry and goes
   * back to page 1. */
  const setFilters = useCallback((changes: Partial<Pick<RouteState, "query" | "letter">>) => {
    router.replace(homeUrl({ query: route.query, letter: route.letter, ...changes }), { scrollY: 0 });
  }, [router, route.query, route.letter]);

  const clearFilters = useCallback(() => setFilters({ query: "", letter: null }), [setFilters]);

  /** On the home view, the brand link clears the filters. On a game page
   * it's a back arrow to the grid the user came from, as they left it. */
  const onBrandClick = useCallback(() => {
    if (view === "home") clearFilters();
    else if (router.state.fromHome) router.go(-router.state.fromHome);
    else router.push("./");
  }, [view, router, clearFilters]);

  // Back, Forward and reloads restore the grid's saved scroll position;
  // any other navigation starts at the top.
  useLayoutEffect(() => {
    if (!catalog) return;
    const restore = view === "home" && (location.cause === "pop" || location.cause === "initial");
    window.scrollTo(0, restore ? router.state.scrollY ?? 0 : 0);
  }, [location, catalog, view, router]);

  // ---------- Content ----------

  const homePage = useMemo(
    () => (catalog && view === "home" ? paginate(catalog.filter(route.query, route.letter), route.page) : null),
    [catalog, view, route.query, route.letter, route.page],
  );
  const game = catalog && route.gameKey !== null ? catalog.get(route.gameKey) : null;
  const status = statusText(catalogState.status, catalog, homePage?.total ?? 0, view, game);
  const title = view === "home" ? BRAND : `${game ? game.title : "Game not found"} — ${BRAND}`;

  useEffect(() => { document.title = catalog ? title : BRAND; }, [catalog, title]);

  let content;
  if (catalogState.status === "loading") {
    content = <LoadingGrid />;
  } else if (catalogState.status === "error") {
    content = (
      <Message text={navigator.onLine ? "Couldn't load the games. Please try again." : "You're offline and the games haven't been saved on this device yet."}>
        <button className="btn" type="button" onClick={retry}>Try again</button>
      </Message>
    );
  } else if (homePage) {
    content = <HomeView route={route} page={homePage} onOpenGame={openGame} onPage={goToPage} onClearFilters={clearFilters} />;
  } else {
    content = <GameView game={game} page={route.page} onPage={goToPage} onHome={goHome} />;
  }

  return (
    <div className={`app view-${view}`}>
      <AppBar view={view} status={status} onBrandClick={onBrandClick}>
        {view === "home" && (
          <>
            <SearchBox value={route.query} onChange={(query) => setFilters({ query })} />
            <LetterStrip
              letters={catalog?.letters() ?? []}
              active={route.letter}
              onSelect={(letter) => setFilters({ letter })}
            />
          </>
        )}
      </AppBar>
      <main id="main" className="main">{content}</main>
      <Footer />
      <Halloween />
    </div>
  );
}

function statusText(
  loading: "loading" | "ready" | "error",
  catalog: GameCatalog | null,
  shown: number,
  view: "home" | "game",
  game: { videos: readonly unknown[] } | null,
): string {
  if (loading === "loading") return "Loading…";
  if (!catalog) return "";
  if (view === "game") return game ? plural(game.videos.length, "video") : "";
  const total = catalog.games.length;
  return shown === total ? plural(total, "game") : `${shown} of ${plural(total, "game")}`;
}

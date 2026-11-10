import { useCallback } from "react";
import { gameImages, type Game } from "../lib/catalog.ts";
import type { Page } from "../lib/pagination.ts";
import { gameUrl, homeUrl, type RouteState } from "../lib/routes.ts";
import { plural } from "../lib/text.ts";
import { Card } from "./Card.tsx";
import { Message } from "./Message.tsx";
import { PagedGrid } from "./PagedGrid.tsx";

interface Props {
  route: RouteState;
  page: Page<Game>;
  onOpenGame: (url: string) => void;
  onPage: (url: string) => void;
  onClearFilters: () => void;
}

/** The grid of every game, filtered by the search box and the A-Z index.
 * Games without videos yet are listed too. */
export function HomeView({ route, page, onOpenGame, onPage, onClearFilters }: Props) {
  const { query, letter } = route;
  const urlFor = useCallback((p: number) => homeUrl({ query, letter, page: p }), [query, letter]);

  if (page.total === 0 && !query.trim() && !letter) return <Message text="There are no games yet." />;
  if (page.total === 0) {
    const what = query.trim() ? `“${query.trim()}”` : `the letter ${letter}`;
    return (
      <Message text={`No games match ${what}.`}>
        <button className="btn" type="button" onClick={onClearFilters}>Clear filters</button>
      </Message>
    );
  }

  return (
    <PagedGrid
      page={page}
      urlFor={urlFor}
      onNavigate={onPage}
      renderItem={(game) => (
        <Card
          key={game.id}
          href={gameUrl(game.id)}
          title={game.title}
          meta={game.videos.length === 0 ? "No videos yet" : plural(game.videos.length, "video")}
          variant="game"
          images={gameImages(game, game.videos[0])}
          onNavigate={onOpenGame}
        />
      )}
    />
  );
}

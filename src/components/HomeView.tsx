import { useCallback } from "react";
import type { Page } from "../lib/pagination.ts";
import { gameUrl, homeUrl, type RouteState } from "../lib/routes.ts";
import { plural } from "../lib/text.ts";
import type { Game } from "../lib/videos.ts";
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

/** The grid of games, filtered by the search box and the A-Z index. */
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
          key={game.key}
          href={gameUrl(game.key)}
          video={game.videos[0]!}
          title={game.title}
          meta={plural(game.videos.length, "video")}
          variant="game"
          onNavigate={onOpenGame}
        />
      )}
    />
  );
}

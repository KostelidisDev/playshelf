import { useCallback } from "react";
import { videoImages, videoUrl, type Game } from "../lib/catalog.ts";
import { paginate } from "../lib/pagination.ts";
import { gameUrl } from "../lib/routes.ts";
import { AppLink } from "./AppLink.tsx";
import { Card } from "./Card.tsx";
import { Message } from "./Message.tsx";
import { PagedGrid } from "./PagedGrid.tsx";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

interface Props {
  game: Game | null;
  page: number;
  onPage: (url: string) => void;
  onHome: (url: string) => void;
}

/** One game's videos, newest first. Each card opens its video on YouTube. */
export function GameView({ game, page, onPage, onHome }: Props) {
  const id = game?.id ?? "";
  const urlFor = useCallback((p: number) => gameUrl(id, p), [id]);

  return (
    <>
      <h1 className="page-title">{game ? game.title : "Game not found"}</h1>
      {!game ? (
        <Message text="There's no game with that name.">
          <AppLink className="btn" href="./" onNavigate={onHome}>All games</AppLink>
        </Message>
      ) : game.videos.length === 0 ? (
        <Message text="There are no videos for this game yet.">
          <AppLink className="btn" href="./" onNavigate={onHome}>All games</AppLink>
        </Message>
      ) : (
        <PagedGrid
          page={paginate(game.videos, page)}
          urlFor={urlFor}
          onNavigate={onPage}
          renderItem={(video) => (
            <Card
              key={video.id}
              href={videoUrl(video)}
              title={video.title}
              meta={video.publishedAt ? dateFormat.format(video.publishedAt) : ""}
              variant="video"
              images={videoImages(video)}
              external
            />
          )}
        />
      )}
    </>
  );
}

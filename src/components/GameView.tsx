import { useCallback } from "react";
import { paginate } from "../lib/pagination.ts";
import { gameUrl } from "../lib/routes.ts";
import { videoUrl, type Game } from "../lib/videos.ts";
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
  const key = game?.key ?? "";
  const urlFor = useCallback((p: number) => gameUrl(key, p), [key]);

  return (
    <>
      <h1 className="page-title">{game ? game.title : "Game not found"}</h1>
      {game ? (
        <PagedGrid
          page={paginate(game.videos, page)}
          urlFor={urlFor}
          onNavigate={onPage}
          renderItem={(video) => (
            <Card
              key={video.id}
              href={videoUrl(video)}
              video={video}
              title={video.title}
              meta={video.publishedAt ? dateFormat.format(video.publishedAt) : ""}
              variant="video"
              external
            />
          )}
        />
      ) : (
        <Message text="There are no videos for this game.">
          <AppLink className="btn" href="./" onNavigate={onHome}>All games</AppLink>
        </Message>
      )}
    </>
  );
}

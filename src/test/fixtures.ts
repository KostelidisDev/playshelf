import { GameCatalog, type Video } from "../lib/videos.ts";

let counter = 0;

/** A video with a new, valid id, one day newer than the last. */
export function makeVideo(gameTitle: string, overrides: Partial<Video> = {}): Video {
  counter++;
  return {
    id: `vid${String(counter).padStart(8, "0")}`,
    title: `${gameTitle || "Loose"} episode ${counter}`,
    publishedAt: new Date(Date.UTC(2024, 0, 1) + counter * 86_400_000),
    gameTitle,
    ...overrides,
  };
}

/** A catalog of `count` games, "Game 01" to "Game NN" with one video each,
 * plus any `extra` videos. */
export function makeCatalog(count: number, extra: Video[] = []): GameCatalog {
  const games = Array.from({ length: count }, (_, i) => makeVideo(`Game ${String(i + 1).padStart(2, "0")}`));
  return new GameCatalog([...games, ...extra]);
}

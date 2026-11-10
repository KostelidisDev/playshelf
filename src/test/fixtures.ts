import { Catalog, type GameRecord, type VideoRecord } from "../lib/catalog.ts";

let counter = 0;

/** A video as the tests describe it: the games it's on are named by title. */
export interface VideoSpec {
  readonly id: string;
  readonly title: string;
  readonly publishedAt: Date;
  readonly gameTitles: readonly string[];
}

/** A video with a new, valid id, one day newer than the last, on the given
 * game (or games). */
export function makeVideo(gameTitles: string | readonly string[], overrides: Partial<VideoSpec> = {}): VideoSpec {
  counter++;
  const titles = typeof gameTitles === "string" ? [gameTitles] : [...gameTitles];
  return {
    id: `vid${String(counter).padStart(8, "0")}`,
    title: `${titles[0] || "Loose"} episode ${counter}`,
    publishedAt: new Date(Date.UTC(2024, 0, 1) + counter * 86_400_000),
    gameTitles: titles,
    ...overrides,
  };
}

/** A game id from its title, as the studio would make one. */
export const gameId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";

/** A catalog of `count` games, "Game 01" to "Game NN" (with no videos), plus
 * the games the `extra` videos are on, and those videos. */
export function makeCatalog(count: number, extra: VideoSpec[] = []): Catalog {
  const titles = Array.from({ length: count }, (_, i) => `Game ${String(i + 1).padStart(2, "0")}`);
  for (const video of extra) {
    for (const title of video.gameTitles) if (!titles.includes(title)) titles.push(title);
  }
  const games: GameRecord[] = titles.map((title) => ({ id: gameId(title), title }));
  const videos: VideoRecord[] = extra.map((video) => ({
    id: video.id,
    title: video.title,
    publishedAt: video.publishedAt.toISOString(),
    gameIds: video.gameTitles.map(gameId),
  }));
  return new Catalog(games, videos);
}

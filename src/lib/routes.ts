/* The app's state in the URL. "./" is the game grid (?q= search, ?l=
 * letter, ?p= page); "./?g=<game>" is one game's videos (also ?p=). */

export interface RouteState {
  /** null on the grid of games. */
  gameKey: string | null;
  query: string;
  letter: string | null;
  page: number;
}

export const MAX_QUERY_LENGTH = 200;

/** Reads the state from a query string. The values are untrusted input:
 * they're only compared, put back into URLs through URLSearchParams, or
 * shown as text. Invalid letters and pages fall back to the defaults. */
export function parseRoute(search: string): RouteState {
  const params = new URLSearchParams(search);
  const letter = params.get("l");
  const page = params.get("p");
  return {
    gameKey: params.get("g"),
    query: (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH),
    letter: letter && /^([A-Z]|#)$/.test(letter) ? letter : null,
    page: page && /^[1-9]\d{0,4}$/.test(page) ? Number(page) : 1,
  };
}

/** The grid's URL, leaving out default values. */
export function homeUrl({ query = "", letter = null, page = 1 }: { query?: string; letter?: string | null; page?: number } = {}): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (letter) params.set("l", letter);
  if (page > 1) params.set("p", String(page));
  const search = params.toString();
  return search ? `./?${search}` : "./";
}

/** A game's URL; `key` is the game title as in the catalog. */
export function gameUrl(key: string, page = 1): string {
  const params = new URLSearchParams({ g: key });
  if (page > 1) params.set("p", String(page));
  return `./?${params}`;
}

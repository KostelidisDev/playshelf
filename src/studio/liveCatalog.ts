/* Reads the catalog the site is serving right now, so the editor opens what
 * visitors see. The files are fetched from the site's own folder, past the
 * browser's cache, and the editor's worker doesn't cache them either. A
 * failure is returned as a message, so the editor can offer to open the
 * files by hand instead. */

import { GAMES_URL, VIDEOS_URL } from "../lib/catalog.ts";

/** The largest file that can be a catalog file; anything bigger is the wrong file. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface LiveFiles {
  readonly games: string;
  readonly videos: string;
}

/** A problem with the answer itself, whose message is shown as it is. */
class LiveError extends Error {
  override name = "LiveError";
}

export type LiveResult = { readonly ok: true; readonly files: LiveFiles } | { readonly ok: false; readonly error: string };

/** Both files, from `base` (the editor's own address, /studio/). The site's
 * files sit one folder up, so the paths start with "../". */
export async function fetchLiveCatalog(base: string, fetcher: typeof fetch = fetch): Promise<LiveResult> {
  const read = async (path: string): Promise<string> => {
    const response = await fetcher(new URL(`../${path}`, base), { cache: "no-store" });
    if (!response.ok) throw new LiveError(`The site answered ${response.status} for ${path.split("/").pop()}.`);
    const text = await response.text();
    if (text.length > MAX_FILE_BYTES) throw new LiveError(`${path.split("/").pop()} is too large to be a catalog file.`);
    return text;
  };
  try {
    const [games, videos] = await Promise.all([read(GAMES_URL), read(VIDEOS_URL)]);
    return { ok: true, files: { games, videos } };
  } catch (error) {
    return { ok: false, error: error instanceof LiveError ? error.message : "The site couldn't be reached." };
  }
}

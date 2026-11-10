/* Looks up a video's title from the editor's own page, with YouTube's oEmbed
 * endpoint. The page's policy allows that one origin (site.conf's /studio/
 * block). No referrer is sent, so the editor's address stays out of it. */

import { oembedTitle, oembedUrl } from "../lib/studio.ts";

/** The title of the video with this id, or null when YouTube has none for it
 * (a private or removed video, say). Rejects on a network failure or an
 * abort. */
export async function lookUpTitle(id: string, signal: AbortSignal): Promise<string | null> {
  const response = await fetch(oembedUrl(id), { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) return null;
  return oembedTitle(await response.json());
}

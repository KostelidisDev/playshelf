/* Looks up a video's title, and with a YouTube key its publish time too, from
 * the editor's own page. The page's policy allows the two YouTube origins
 * (site.conf's /studio/ block). No referrer is sent, and no credentials, so
 * the editor's address stays out of it. Without a key, or when the Data API
 * refuses the key, the title comes from YouTube's oEmbed endpoint, which has
 * no publish time. */

import { dataApiUrl, dataApiVideo, oembedTitle, oembedUrl } from "../lib/studio.ts";

export interface VideoLookup {
  /** The video's title, or null when YouTube has none for it. */
  readonly title: string | null;
  /** The publish time as the file keeps it, or null when it isn't known. */
  readonly publishedAt: string | null;
}

const NONE: VideoLookup = { title: null, publishedAt: null };
const OPTIONS: RequestInit = { credentials: "omit", referrerPolicy: "no-referrer" };

/** The title, and with a key the publish time, of the video with this id.
 * Rejects on a network failure or an abort. */
export async function lookUpVideo(id: string, key: string | null, signal: AbortSignal): Promise<VideoLookup> {
  if (key) {
    try {
      const response = await fetch(dataApiUrl(id, key), { ...OPTIONS, signal });
      if (response.ok) {
        const video = dataApiVideo(await response.json());
        if (video) return video;
      }
    } catch (error) {
      if (signal.aborted) throw error;
      // Fall through to oEmbed: a refused key still gets the title.
    }
  }
  const response = await fetch(oembedUrl(id), { ...OPTIONS, signal });
  if (!response.ok) return NONE;
  return { title: oembedTitle(await response.json()), publishedAt: null };
}

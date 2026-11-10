/* The optional YouTube Data API key the editor uses to fill a video's publish
 * date. It's kept in this browser only, in localStorage, so each person who
 * edits enters their own. Every call can fail (private windows, blocked site
 * data), and then the editor just has no key and looks up titles only. */

const STORAGE_KEY = "playshelf-studio-youtube-key";

/** The saved key, or null when none is saved. */
export function loadYouTubeKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

/** Saves the key, or forgets it when the text is empty. Returns false when the
 * browser wouldn't keep it. */
export function saveYouTubeKey(key: string): boolean {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

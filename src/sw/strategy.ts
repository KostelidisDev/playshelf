/* The service worker's decisions, as pure functions so they can be unit
 * tested without a worker. */

export type Strategy =
  | { kind: "navigate" }
  | { kind: "cache-first" }
  | { kind: "network-first" }
  | { kind: "ignore" };

/** How the worker answers a request. `origin` is the worker's own. */
export function strategyFor(request: { method: string; mode: string; url: string }, origin: string): Strategy {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return { kind: "ignore" };
  // The catalog editor (/studio/) is its own page, and a tool to use online:
  // the network answers it, rather than the app shell.
  if (url.pathname.includes("/studio/")) return { kind: "ignore" };
  // Every page is the one app shell, whatever its query string.
  if (request.mode === "navigate") return { kind: "navigate" };
  // A video's thumbnail never changes.
  if (url.pathname.includes("/assets/thumbnails/")) return { kind: "cache-first" };
  return { kind: "network-first" };
}

/** The cache key for a request. Query strings carry app state (?g=, ?q=),
 * not different files, so they're dropped, and index.html is stored as ./. */
export function cacheKey(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.search = "";
  url.hash = "";
  return url.pathname.endsWith("/index.html") ? new URL("./", url).href : url.href;
}

/** Whether a response may be cached: only complete, same-origin 200s. Never
 * opaque or redirected responses, and never errors, so a 401 from the auth
 * proxy can't become the offline copy. */
export function cacheable(response: Pick<Response, "ok" | "status" | "type" | "redirected">): boolean {
  return response.ok && response.status === 200 && response.type === "basic" && !response.redirected;
}

// ---------- The catalog editor (/studio/) ----------

/** The editor's worker (studio.ts) names its cache with this prefix. The two
 * workers share the origin's caches, so each one clears only its own old
 * caches: the site's worker leaves these alone, and the editor's leaves the
 * site's. */
export const STUDIO_CACHE_PREFIX = "studio-shell-";

/** The caches to delete when a worker activates: the old ones of its own
 * kind. `current` are the names it still uses. */
export function staleCaches(keys: readonly string[], current: ReadonlySet<string>, owner: "site" | "studio"): string[] {
  return keys.filter((key) => {
    if (current.has(key)) return false;
    const isStudio = key.startsWith(STUDIO_CACHE_PREFIX);
    return owner === "studio" ? isStudio : !isStudio;
  });
}

/** How the editor's worker answers a request, where `scope` is its folder
 * (https://site/studio/). Its own pages and their files are answered; the
 * site's hashed app files and icons, which the editor also loads, are
 * cache-first. Everything else is left to the network. */
export function studioStrategyFor(request: { method: string; mode: string; url: string }, scope: string): Strategy {
  if (request.method !== "GET") return { kind: "ignore" };
  const url = new URL(request.url).href;
  if (url.startsWith(scope)) return request.mode === "navigate" ? { kind: "navigate" } : { kind: "network-first" };
  const root = new URL("../", scope).href;
  if (url.startsWith(`${root}assets/app/`) || url.startsWith(`${root}assets/icons/`)) return { kind: "cache-first" };
  return { kind: "ignore" };
}

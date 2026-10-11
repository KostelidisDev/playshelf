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

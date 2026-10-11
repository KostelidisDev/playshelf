/* The service worker: makes the site installable and usable offline.
 *
 * - Pages, the app's files and videos.csv: network first, so a new deploy
 *   or catalog shows up on the next load. The cached copy answers when
 *   offline, or when the network is slower than NETWORK_TIMEOUT_MS.
 * - Thumbnails: cache first, since a video's thumbnail never changes. They
 *   are cached as they're viewed, not all up front.
 *
 * The shell cache is named after the build version, so each deploy starts a
 * fresh one. Built by vite.sw.config.ts, which also fills in __SHELL__. */

import { cacheable, cacheKey, strategyFor } from "./strategy.ts";

declare const self: ServiceWorkerGlobalScope;

const SHELL_CACHE = `shell-${__APP_VERSION__}`;
const THUMBNAIL_CACHE = "thumbnails-v1";
const NETWORK_TIMEOUT_MS = 4000;
/** Every page is this one document; its cached copy answers any navigation. */
const APP_SHELL = "./";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(__SHELL__.map((url) => new Request(url, { cache: "no-cache" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, THUMBNAIL_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = strategyFor(request, self.location.origin);
  switch (strategy.kind) {
    case "navigate":
      event.respondWith(networkFirst(request, APP_SHELL));
      break;
    case "cache-first":
      event.respondWith(cacheFirst(request, THUMBNAIL_CACHE));
      break;
    case "network-first":
      event.respondWith(networkFirst(request, null));
      break;
    case "ignore":
      break;
  }
});

/** The network's response, or the cached copy (or `fallbackUrl`'s) when the
 * network fails or is too slow. */
async function networkFirst(request: Request, fallbackUrl: string | null): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);
  const key = cacheKey(request.url);
  // Revalidate with the server rather than trust the HTTP cache. A
  // navigation request can't take new options, and HTML isn't HTTP-cached.
  const network = fetch(request, request.mode === "navigate" ? undefined : { cache: "no-cache" }).then((response) => {
    if (cacheable(response)) void cache.put(key, response.clone());
    return response;
  });

  // With a cached copy to show, don't wait long on a slow connection.
  const cached = (await cache.match(key))
    ?? (fallbackUrl ? await cache.match(new URL(fallbackUrl, self.location.href).href) : undefined);
  if (!cached) return network;
  const timeout = new Promise<Response>((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

/** The cached response, or the network's (cached for next time). */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) void cache.put(request, response.clone());
  return response;
}

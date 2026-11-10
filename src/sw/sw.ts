/* The service worker: makes the site installable and usable offline.
 *
 * - Pages, the app's files and the catalog (Games.txt, Videos.txt): network
 *   first, so a new deploy or catalog shows up on the next load. The cached copy answers when
 *   offline, or when the network is slower than NETWORK_TIMEOUT_MS.
 * - Thumbnails: cache first, since a video's thumbnail never changes. They
 *   are cached as they're viewed, not all up front.
 *
 * The shell cache is named after the build version, so each deploy starts a
 * fresh one. Built by vite.sw.config.ts, which also fills in __SHELL__. */

import { cacheFirst, networkFirst } from "./fetch.ts";
import { staleCaches, strategyFor } from "./strategy.ts";

declare const self: ServiceWorkerGlobalScope;

const SHELL_CACHE = `shell-${__APP_VERSION__}`;
const THUMBNAIL_CACHE = "thumbnails-v1";
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
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(staleCaches(keys, new Set([SHELL_CACHE, THUMBNAIL_CACHE]), "site").map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = strategyFor(request, self.location.origin);
  switch (strategy.kind) {
    case "navigate":
      event.respondWith(networkFirst(request, SHELL_CACHE, APP_SHELL));
      break;
    case "cache-first":
      event.respondWith(cacheFirst(request, THUMBNAIL_CACHE));
      break;
    case "network-first":
      event.respondWith(networkFirst(request, SHELL_CACHE, null));
      break;
    case "ignore":
      break;
  }
});

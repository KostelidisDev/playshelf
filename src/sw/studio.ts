/* The catalog editor's service worker (dist/studio/sw.js, scope /studio/):
 * makes the editor installable and usable offline. The editor fetches the
 * site's live catalog in the page itself, and its download is made there too,
 * so the worker only keeps the editor's own pages and files: its HTML, the
 * hashed JS and CSS it loads and its icons, precached on install (the list
 * comes from dist/studio/index.html, see build/shell.ts). It never caches the
 * catalog (those requests go straight to the network). The editor's copy of
 * unsaved changes lives in IndexedDB, which the worker never touches. Built by vite.studio-sw.config.ts, which
 * also fills in __STUDIO_SHELL__. */

import { cacheFirst, networkFirst } from "./fetch.ts";
import { staleCaches, studioStrategyFor, STUDIO_CACHE_PREFIX } from "./strategy.ts";

declare const self: ServiceWorkerGlobalScope;

const SHELL_CACHE = `${STUDIO_CACHE_PREFIX}${__APP_VERSION__}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(__STUDIO_SHELL__.map((url) => new Request(new URL(url, self.registration.scope), { cache: "no-cache" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(staleCaches(keys, new Set([SHELL_CACHE]), "studio").map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = studioStrategyFor(request, self.registration.scope);
  switch (strategy.kind) {
    case "navigate":
      // The editor is one page, whatever its query string.
      event.respondWith(networkFirst(request, SHELL_CACHE, self.registration.scope));
      break;
    case "cache-first":
      event.respondWith(cacheFirst(request, SHELL_CACHE));
      break;
    case "network-first":
      event.respondWith(networkFirst(request, SHELL_CACHE, null));
      break;
    case "ignore":
      break;
  }
});

/* The fetch helpers both workers use (the site's in sw.ts, the catalog
 * editor's in studio.ts): network first with the cached copy as the fallback,
 * and cache first. Each worker passes its own cache name. */

import { cacheable, cacheKey } from "./strategy.ts";

declare const self: ServiceWorkerGlobalScope;

/** How long a slow network may take before the cached copy answers. */
export const NETWORK_TIMEOUT_MS = 4000;

/** The network's response, or the cached copy (or `fallbackUrl`'s) when the
 * network fails or is too slow. */
export async function networkFirst(request: Request, cacheName: string, fallbackUrl: string | null): Promise<Response> {
  const cache = await caches.open(cacheName);
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
export async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) void cache.put(request, response.clone());
  return response;
}

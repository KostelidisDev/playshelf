import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_TIMEOUT_MS, networkFirst } from "./fetch.ts";

/** A stand-in for the Cache API: enough for what fetch.ts calls. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    stores,
    open: vi.fn(async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        match: async (key: string) => store.get(key),
        put: async (key: string, response: Response) => { store.set(key, response); },
      };
    }),
  };
}

describe("networkFirst", () => {
  let cache: ReturnType<typeof fakeCaches>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = fakeCaches();
    vi.stubGlobal("caches", cache);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const request = () => new Request("https://site.example/assets/api/Games.txt");

  it("answers with the network, and leaves no timer behind, when the network is fast", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("fresh")));
    cache.stores.set("shell", new Map([["https://site.example/assets/api/Games.txt", new Response("cached")]]));

    const response = await networkFirst(request(), "shell", null);

    expect(await response.text()).toBe("fresh");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("answers with the cached copy when the network is too slow", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    cache.stores.set("shell", new Map([["https://site.example/assets/api/Games.txt", new Response("cached")]]));

    const pending = networkFirst(request(), "shell", null);
    await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUT_MS);

    expect(await (await pending).text()).toBe("cached");
  });

  it("waits for the network when nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("fresh")));

    const response = await networkFirst(request(), "shell", null);

    expect(await response.text()).toBe("fresh");
  });
});

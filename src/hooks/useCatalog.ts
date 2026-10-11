import { useCallback, useEffect, useState } from "react";
import { GameCatalog } from "../lib/videos.ts";

export type CatalogState =
  | { status: "loading" }
  | { status: "ready"; catalog: GameCatalog }
  | { status: "error"; error: unknown };

export type CatalogLoader = () => Promise<GameCatalog>;

const defaultLoader: CatalogLoader = () => GameCatalog.load();

/** Loads the catalog once on mount. The returned `retry` loads it again,
 * for after an error. */
export function useCatalog(load: CatalogLoader = defaultLoader): [CatalogState, () => void] {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (catalog) => { if (!cancelled) setState({ status: "ready", catalog }); },
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", error });
      },
    );
    return () => { cancelled = true; };
  }, [load, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return [state, retry];
}

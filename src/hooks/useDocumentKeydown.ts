import { useEffect, useRef } from "react";

/** Calls `handler` for every keydown on the document while mounted. It
 * always calls the latest handler, without subscribing again. */
export function useDocumentKeydown(handler: (event: KeyboardEvent) => void): void {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => latest.current(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}

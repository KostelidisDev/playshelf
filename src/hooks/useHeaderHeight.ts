import { useEffect, type RefObject } from "react";

/** Keeps --appbar-h, the header's real height, up to date for the CSS
 * that offsets content below it. Set through the CSSOM, which the CSP
 * allows (unlike style attributes). */
export function useHeaderHeight(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--appbar-h", `${header.offsetHeight}px`);
    const observer = new ResizeObserver(update);
    observer.observe(header);
    update();
    return () => observer.disconnect();
  }, [ref]);
}

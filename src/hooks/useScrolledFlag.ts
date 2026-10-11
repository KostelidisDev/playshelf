import { useEffect } from "react";

const SCROLLED_AFTER_PX = 8;

/** Sets `data-scrolled` on <html> once the page has scrolled, which turns
 * on the header's glass panel. It writes to the DOM only when that flips,
 * so scrolling itself causes no style work and no React render. */
export function useScrolledFlag(): void {
  useEffect(() => {
    const root = document.documentElement;
    let scrolled: boolean | null = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const now = window.scrollY > SCROLLED_AFTER_PX;
      if (now !== scrolled) root.toggleAttribute("data-scrolled", (scrolled = now));
    };
    const onScroll = () => { frame ||= requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
}

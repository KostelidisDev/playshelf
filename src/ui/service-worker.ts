/** Registers sw.js (built by vite.sw.config.ts) after the page has loaded,
 * so the worker's precaching doesn't compete with the first render. */
export function registerServiceWorker(nav: Navigator = navigator, win: Window = window): void {
  if (!("serviceWorker" in nav)) return;
  win.addEventListener("load", () => {
    nav.serviceWorker.register("sw.js").catch((err: unknown) => console.warn("Service worker registration failed", err));
  });
}

/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { siteNamePlugin } from "./build/site-name.ts";
import { sitePolicy } from "./build/csp.ts";
import { APP_ASSETS_DIR } from "./build/shell.ts";
import { appVersion } from "./build/version.ts";

// The app (index.html and everything it loads). The service worker is a
// second build, run after this one: vite.sw.config.ts.
export default defineConfig({
  base: "./",
  plugins: [react(), siteNamePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  build: {
    outDir: "dist",
    assetsDir: APP_ASSETS_DIR,
    // The CSP allows no data: URLs, so every asset must be a real file.
    assetsInlineLimit: 0,
    // Every supported browser has native modulepreload; the polyfill would
    // only add a script.
    modulePreload: { polyfill: false },
  },
  // `npm run preview` serves the build under the production CSP. (`vite dev`
  // can't: its module loading needs inline code.)
  preview: {
    headers: { "Content-Security-Policy": sitePolicy("site.conf") },
  },
  test: {
    environment: "jsdom",
    // One jsdom per worker, each test file in its own VM context: files stay
    // isolated without building a new jsdom for each.
    pool: "vmThreads",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "build/**/*.test.ts"],
    restoreMocks: true,
  },
});

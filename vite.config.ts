/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { sitePlugin } from "./build/site.ts";
import { sitePolicy, studioPolicy } from "./build/csp.ts";
import { APP_ASSETS_DIR } from "./build/shell.ts";
import { appVersion } from "./build/version.ts";

// `npm run preview` serves the build under the production CSP, the site's
// policy or the editor's, chosen by path as Apache does it from site.conf.
// (`vite dev` can't: its module loading needs inline code.)
function previewPolicy(): Plugin {
  const site = sitePolicy("site.conf");
  const studio = studioPolicy("site.conf");
  return {
    name: "preview-csp",
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const editor = /^\/studio(?:[/?]|$)/.test(request.url ?? "");
        response.setHeader("Content-Security-Policy", editor ? studio : site);
        next();
      });
    },
  };
}

// The app (index.html and everything it loads), and the catalog editor at
// /studio/ (studio/index.html), which shares its code and assets. The
// service worker is a second build, run after this one: vite.sw.config.ts.
export default defineConfig({
  base: "./",
  plugins: [react(), sitePlugin(), previewPolicy()],
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
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        studio: fileURLToPath(new URL("./studio/index.html", import.meta.url)),
      },
    },
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

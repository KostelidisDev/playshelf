import { defineConfig } from "vite";
import { studioShellFiles } from "./build/shell.ts";
import { appVersion } from "./build/version.ts";

// The catalog editor's service worker (dist/studio/sw.js). Built after the
// app, so it can list the editor's hashed files for precaching. `npm run
// build` runs all three.
export default defineConfig({
  publicDir: false,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __STUDIO_SHELL__: JSON.stringify(studioShellFiles("dist")),
  },
  build: {
    outDir: "dist/studio",
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: "src/sw/studio.ts",
      formats: ["es"],
      fileName: () => "sw.js",
    },
  },
});

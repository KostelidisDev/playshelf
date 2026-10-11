import { defineConfig } from "vite";
import { shellFiles } from "./build/shell.ts";
import { appVersion } from "./build/version.ts";

// The service worker (dist/sw.js). Built after the app, so it can list the
// app's hashed files for precaching. `npm run build` runs both.
export default defineConfig({
  publicDir: false,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __SHELL__: JSON.stringify(shellFiles("dist")),
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: "src/sw/sw.ts",
      formats: ["es"],
      fileName: () => "sw.js",
    },
  },
});

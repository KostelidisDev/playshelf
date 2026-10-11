/* The service worker's app shell: the files it precaches on install, so the
 * site works offline. The list is read from the finished app build (dist/),
 * because the JS and CSS file names carry content hashes. Thumbnails aren't
 * in it: the worker caches them as they're viewed. */

import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Where Vite writes the hashed JS and CSS (build.assetsDir). */
export const APP_ASSETS_DIR = "assets/app";

/** Precached on top of the hashed app files. */
const ALWAYS = [
  "./",
  "manifest.webmanifest",
  "assets/api/videos.csv",
  "assets/icons/icon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/apple-touch-icon.png",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** The shell's URLs, relative to the site root, without source maps. */
export function shellFiles(distDir: string): string[] {
  const appDir = join(distDir, APP_ASSETS_DIR);
  const built = walk(appDir)
    .map((file) => relative(distDir, file).split(sep).join("/"))
    .filter((file) => !file.endsWith(".map"))
    .sort();
  if (!built.some((file) => file.endsWith(".js"))) throw new Error(`No app build in ${appDir}; run the app build first`);
  return [...ALWAYS, ...built];
}

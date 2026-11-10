/* The service worker's app shell: the files it precaches on install, so the
 * site works offline. The list is read from the finished app build (dist/),
 * because the JS and CSS file names carry content hashes. Thumbnails aren't
 * in it: the worker caches them as they're viewed. */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Where Vite writes the hashed JS and CSS (build.assetsDir). */
export const APP_ASSETS_DIR = "assets/app";

/** Precached on top of the hashed app files. */
const ALWAYS = [
  "./",
  "manifest.webmanifest",
  "assets/api/Games.txt",
  "assets/api/Videos.txt",
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

/** Precached by the editor's worker, on top of its hashed files: its page
 * and manifest, and the icons. Relative to /studio/. */
const STUDIO_ALWAYS = [
  "./",
  "manifest.webmanifest",
  "../assets/icons/icon.svg",
  "../assets/icons/icon-192.png",
  "../assets/icons/icon-512.png",
  "../assets/icons/maskable-512.png",
  "../assets/icons/apple-touch-icon.png",
];

/** The editor's shell, relative to /studio/: its page, the hashed files the
 * page loads (read from dist/studio/index.html, whose names change with each
 * build), and the icons. */
export function studioShellFiles(distDir: string): string[] {
  const page = join(distDir, "studio", "index.html");
  const html = readFileSync(page, "utf8");
  const loaded = [...html.matchAll(/(?:src|href)="(\.\.?\/[^"]+)"/g)].map((match) => match[1]!);
  if (!loaded.some((file) => file.endsWith(".js"))) throw new Error(`No editor build in ${page}; run the app build first`);
  return [...new Set([...STUDIO_ALWAYS, ...loaded])];
}

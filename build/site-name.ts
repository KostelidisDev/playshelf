/* Fills in the site name under `vite dev` and `vite preview`. In the
 * container, Apache replaces the __SITE_NAME__ placeholders in
 * index.html and the web manifest with SITE_NAME as they're served
 * (site.conf, docker-entrypoint.sh). This plugin does the same locally, so
 * the build itself never contains a site name. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";

export const PLACEHOLDER = "__SITE_NAME__";
export const DEFAULT_SITE_NAME = "PlayShelf";

/** SITE_NAME, trimmed, or the default. A single line of text only. */
export function siteName(env: NodeJS.ProcessEnv = process.env): string {
  const name = env.SITE_NAME?.trim() || DEFAULT_SITE_NAME;
  if (/[\p{Cc}]/u.test(name)) throw new Error(`Invalid SITE_NAME: ${JSON.stringify(name)}`);
  return name;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Fills the placeholders in HTML, escaped for text and attribute values. */
export function fillHtml(html: string, name: string): string {
  return html.replaceAll(PLACEHOLDER, name.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!));
}

/** Fills placeholders that sit inside JSON strings. */
export function fillJson(json: string, name: string): string {
  return json.replaceAll(PLACEHOLDER, JSON.stringify(name).slice(1, -1));
}

/** Serves the web manifest from `dir` with the name filled in, and
 * index.html too when `html` is set. */
function fillMiddleware(dir: string, name: string, html: boolean): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const file = path === "/" ? "index.html" : path.slice(1);
    const isManifest = file === "manifest.webmanifest";
    if (!isManifest && !(html && file === "index.html")) return next();
    readFile(join(dir, file), "utf8").then((text) => {
      res.setHeader("Content-Type", isManifest ? "application/manifest+json" : "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(isManifest ? fillJson(text, name) : fillHtml(text, name));
    }, next);
  };
}

export function siteNamePlugin(): Plugin {
  const name = siteName();
  return {
    name: "site-name",
    // Under `vite dev`, Vite serves the HTML itself (adding its client), so
    // the name is filled in here; the manifest comes from public/.
    transformIndexHtml: { order: "pre", handler: (html, ctx) => (ctx.server ? fillHtml(html, name) : html) },
    configureServer(server) {
      server.middlewares.use(fillMiddleware(server.config.publicDir, name, false));
    },
    configurePreviewServer(server) {
      server.middlewares.use(fillMiddleware(server.config.build.outDir, name, true));
    },
  };
}

/* Fills in the site's name and description under `vite dev` and `vite
 * preview`. In the container, Apache replaces the __SITE_NAME__ and
 * __SITE_DESCRIPTION__ placeholders in index.html and the web manifest with
 * SITE_NAME and SITE_DESCRIPTION as they're served (site.conf,
 * docker-entrypoint.sh). This plugin does the same locally, so the build
 * itself never contains a site's name or description. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";

export const DEFAULT_SITE_NAME = "PlayShelf";
export const DEFAULT_SITE_DESCRIPTION = "A hand-picked collection of YouTube videos, from any creator, grouped by game.";

export interface SiteSettings {
  name: string;
  description: string;
}

const PLACEHOLDERS: Record<string, keyof SiteSettings> = {
  __SITE_NAME__: "name",
  __SITE_DESCRIPTION__: "description",
};

/** One setting, trimmed, or its default. A single line of text only. */
function setting(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key]?.trim() || fallback;
  if (/[\p{Cc}]/u.test(value)) throw new Error(`Invalid ${key}: ${JSON.stringify(value)}`);
  return value;
}

/** SITE_NAME and SITE_DESCRIPTION, or their defaults. */
export function siteSettings(env: NodeJS.ProcessEnv = process.env): SiteSettings {
  return {
    name: setting(env, "SITE_NAME", DEFAULT_SITE_NAME),
    description: setting(env, "SITE_DESCRIPTION", DEFAULT_SITE_DESCRIPTION),
  };
}

function fill(text: string, site: SiteSettings, escape: (value: string) => string): string {
  return text.replace(/__SITE_[A-Z]+__/g, (placeholder) => {
    const key = PLACEHOLDERS[placeholder];
    return key ? escape(site[key]) : placeholder;
  });
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Fills the placeholders in HTML, escaped for text and attribute values. */
export function fillHtml(html: string, site: SiteSettings): string {
  return fill(html, site, (value) => value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!));
}

/** Fills placeholders that sit inside JSON strings. */
export function fillJson(json: string, site: SiteSettings): string {
  return fill(json, site, (value) => JSON.stringify(value).slice(1, -1));
}

/** Serves the web manifest from `dir` with the settings filled in, and
 * index.html too when `html` is set. */
function fillMiddleware(dir: string, site: SiteSettings, html: boolean): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const file = path === "/" ? "index.html" : path.slice(1);
    const isManifest = file === "manifest.webmanifest";
    if (!isManifest && !(html && file === "index.html")) return next();
    readFile(join(dir, file), "utf8").then((text) => {
      res.setHeader("Content-Type", isManifest ? "application/manifest+json" : "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(isManifest ? fillJson(text, site) : fillHtml(text, site));
    }, next);
  };
}

export function sitePlugin(): Plugin {
  const site = siteSettings();
  return {
    name: "site-settings",
    // Under `vite dev`, Vite serves the HTML itself (adding its client), so
    // the settings are filled in here; the manifest comes from public/.
    transformIndexHtml: { order: "pre", handler: (html, ctx) => (ctx.server ? fillHtml(html, site) : html) },
    configureServer(server) {
      server.middlewares.use(fillMiddleware(server.config.publicDir, site, false));
    },
    configurePreviewServer(server) {
      server.middlewares.use(fillMiddleware(server.config.build.outDir, site, true));
    },
  };
}

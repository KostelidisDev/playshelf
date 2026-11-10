/* Fills in the site's name and description under `vite dev` and `vite
 * preview`. In the container, Apache replaces the __SITE_NAME__ and
 * __SITE_DESCRIPTION__ placeholders in index.html and the web manifest with
 * SITE_NAME and SITE_DESCRIPTION as they're served (site.conf,
 * docker-entrypoint.sh). This plugin does the same locally, so the build
 * itself never contains a site's name or description. */

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Connect, Plugin } from "vite";

export const DEFAULT_SITE_NAME = "PlayShelf";
export const DEFAULT_SITE_DESCRIPTION = "A hand-picked collection of YouTube videos, from any creator, grouped by game.";

export interface SiteSettings {
  name: string;
  description: string;
  /** The site's root URL, with a trailing slash, when SITE_URL is set. */
  url?: string;
}

/** Where the site's address is written as a placeholder: the link tags
 * that need an absolute URL (canonical, og:url, og:image). Empty without
 * SITE_URL. Apache fills it in too (site.conf). */
export const LINKS_PLACEHOLDER = "__SITE_LINKS__";
/** The icon that stands in for the page's preview image. */
const PREVIEW_IMAGE = "assets/icons/icon-512.png";
/** An absolute http(s) URL with no spaces, quotes, markup, query or fragment. */
const URL_PATTERN = /^https?:\/\/[^\s"<>|$\\?#]+$/;

/** The pages that carry the site's name: the app's and the catalog editor's. */
export const PAGE_FILES = ["index.html", "studio/index.html"] as const;
/** The web manifests that carry it: the app's and the catalog editor's. */
export const MANIFEST_FILES = ["manifest.webmanifest", "studio/manifest.webmanifest"] as const;

const PLACEHOLDERS: Record<string, "name" | "description"> = {
  __SITE_NAME__: "name",
  __SITE_DESCRIPTION__: "description",
};

/** One setting, trimmed, or its default. A single line of text only. */
function setting(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key]?.trim() || fallback;
  if (/[\p{Cc}]/u.test(value)) throw new Error(`Invalid ${key}: ${JSON.stringify(value)}`);
  return value;
}

/** SITE_NAME, SITE_DESCRIPTION and SITE_URL (optional), or their defaults. */
export function siteSettings(env: NodeJS.ProcessEnv = process.env): SiteSettings {
  const url = siteUrl(env);
  return {
    name: setting(env, "SITE_NAME", DEFAULT_SITE_NAME),
    description: setting(env, "SITE_DESCRIPTION", DEFAULT_SITE_DESCRIPTION),
    ...(url === undefined ? {} : { url }),
  };
}

/** The settings for a site that is published (the container, a standalone
 * build): SITE_URL is required there, as its canonical link and preview
 * image need it. Local builds (`vite dev`, `preview`) don't check it. */
export function requireSiteUrl(site: SiteSettings): SiteSettings & { url: string } {
  if (!site.url) throw new Error("SITE_URL must be set to the site's address, e.g. https://games.example.com");
  return { ...site, url: site.url };
}

/** SITE_URL with a trailing slash, or undefined when it's not set. It must
 * be the address of the site's root (http or https), which is where the
 * preview image and the canonical link point. */
function siteUrl(env: NodeJS.ProcessEnv): string | undefined {
  const value = env.SITE_URL?.trim();
  if (!value) return undefined;
  if (!URL_PATTERN.test(value) || !URL.canParse(value)) throw new Error(`Invalid SITE_URL: ${JSON.stringify(value)}`);
  return value.replace(/\/*$/, "/");
}

function fill(text: string, site: SiteSettings, escape: (value: string) => string): string {
  return text.replace(/__SITE_[A-Z]+__/g, (placeholder) => {
    const key = PLACEHOLDERS[placeholder];
    return key ? escape(site[key]) : placeholder;
  });
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);

/** The link tags that need the site's address, on one line, or nothing
 * without SITE_URL. Their attributes use single quotes: Apache drops this
 * string into a double-quoted Substitute directive (site.conf), where a
 * double quote would end it. */
export function linkTags(site: SiteSettings): string {
  if (!site.url) return "";
  const root = escapeHtml(site.url);
  const image = escapeHtml(`${site.url}${PREVIEW_IMAGE}`);
  return [
    `<link rel='canonical' href='${root}'>`,
    `<meta property='og:url' content='${root}'>`,
    `<meta property='og:image' content='${image}'>`,
    "<meta property='og:image:width' content='512'>",
    "<meta property='og:image:height' content='512'>",
    `<meta name='twitter:image' content='${image}'>`,
  ].join(" ");
}

/** Fills the placeholders in HTML, escaped for text and attribute values. */
export function fillHtml(html: string, site: SiteSettings): string {
  return fill(html.replaceAll(LINKS_PLACEHOLDER, linkTags(site)), site, escapeHtml);
}

/** Fills placeholders that sit inside JSON strings. */
export function fillJson(json: string, site: SiteSettings): string {
  return fill(json, site, (value) => JSON.stringify(value).slice(1, -1));
}

/** Serves the web manifests from `dir` with the settings filled in, and the
 * pages too when `html` is set. A folder's page is its index.html. */
function fillMiddleware(dir: string, site: SiteSettings, html: boolean): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const file = path.endsWith("/") ? `${path.slice(1)}index.html` : path.slice(1);
    const isManifest = basename(file) === "manifest.webmanifest";
    if (!isManifest && !(html && basename(file) === "index.html")) return next();
    // A file that isn't there goes on to the server's own handling (a 404).
    readFile(join(dir, file), "utf8").then((text) => {
      res.setHeader("Content-Type", isManifest ? "application/manifest+json" : "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(isManifest ? fillJson(text, site) : fillHtml(text, site));
    }, () => next());
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

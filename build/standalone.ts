/* The standalone build: dist/ made ready for a managed Apache or shared
 * host, without the container. There, nothing fills in the site's settings
 * as pages are served, and site.conf can't be used, so this copies dist/ to
 * a new directory and:
 *
 * - fills in SITE_NAME and SITE_DESCRIPTION (or their defaults),
 * - adds an .htaccess with site.conf's headers, caching and demo catalog
 *   rewrite, so site.conf stays the single source of the CSP,
 * - leaves out any catalog and thumbnails: the webmaster uploads those, and
 *   unzipping a new release over the site then keeps them.
 *
 * Run after `npm run build`: `npm run standalone -- <out-dir>`. */

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fillHtml, fillJson, siteSettings, type SiteSettings } from "./site.ts";

/** site.conf as logical lines: continuations joined, runs of spaces
 * collapsed, trimmed. */
function confLines(conf: string): string[] {
  return conf.replace(/\\\n/g, " ").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim());
}

function pick(lines: string[], pattern: RegExp, what: string): string[] {
  const found = lines.filter((line) => pattern.test(line));
  if (!found.length) throw new Error(`No ${what} in site.conf`);
  return found;
}

const indent = (lines: string[], depth = 1) => lines.map((line) => `${"    ".repeat(depth)}${line}`).join("\n");

/** The .htaccess for a standalone install, from site.conf's text. Every
 * block but the first needs its module, so a host without one still serves
 * the site. */
export function htaccess(conf: string): string {
  const lines = confLines(conf);
  const denied = pick(lines, /^<FilesMatch "/, "FilesMatch block")[0]!;
  const mime = pick(lines, /^(AddType|AddDefaultCharset|AddCharset) /, "MIME types");
  const headers = pick(lines, /^Header always (set|unset) /, "headers");
  if (!headers.some((line) => line.includes("Content-Security-Policy"))) throw new Error("No Content-Security-Policy in site.conf");
  const deflate = pick(lines, /^AddOutputFilterByType DEFLATE /, "compression");
  const expires = pick(lines, /^Expires(Active|ByType) /, "cache lifetimes");

  return `# PlayShelf on a managed Apache or shared host. Generated from site.conf
# by build/standalone.ts; needs AllowOverride All (the usual on shared
# hosts).

DirectoryIndex index.html
Options -Indexes

# Never serve dotfiles, backups, scripts or editor leftovers.
${denied}
    Require all denied
</FilesMatch>

<IfModule mod_mime.c>
${indent([...mime, "AddType image/webp .webp"])}
</IfModule>

# Until assets/api/videos.csv is uploaded, the demo catalog is served in its
# place.
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^assets/api/videos\\.csv$ assets/demo/videos.csv [L]
</IfModule>

<IfModule mod_headers.c>
${indent(headers)}
    # Browsers must always revalidate the service worker, so an update
    # reaches them on the next visit.
    <Files "sw.js">
        Header set Cache-Control "no-cache"
    </Files>
</IfModule>

<IfModule mod_filter.c>
    <IfModule mod_deflate.c>
${indent(deflate, 2)}
    </IfModule>
</IfModule>

<IfModule mod_expires.c>
${indent(expires)}
</IfModule>
`;
}

/** Whether a file from dist/ goes into the standalone site: no catalog or
 * thumbnails (the webmaster's own), no placeholders and no Finder files. */
function shipped(path: string): boolean {
  const name = path.split("/").at(-1) ?? "";
  if (name === ".gitkeep" || name === ".DS_Store") return false;
  return !/^assets\/(api|thumbnails)\/./.test(path);
}

/** Copies `distDir` to `outDir` (replacing it) as a standalone site. */
export function buildStandalone(distDir: string, outDir: string, site: SiteSettings, confPath: string): void {
  const dist = resolve(distDir);
  const out = resolve(outDir);
  if (!existsSync(join(dist, "index.html"))) throw new Error(`No build in ${distDir}; run npm run build first`);
  if (out === dist || out.startsWith(dist + sep) || dist.startsWith(out + sep)) {
    throw new Error("The output directory must be outside dist/");
  }

  rmSync(out, { recursive: true, force: true });
  cpSync(dist, out, {
    recursive: true,
    filter: (source) => shipped(relative(dist, source).split(sep).join("/")),
  });

  for (const [file, fill] of [["index.html", fillHtml], ["manifest.webmanifest", fillJson]] as const) {
    const path = join(out, file);
    const text = fill(readFileSync(path, "utf8"), site);
    if (text.includes("__SITE_")) throw new Error(`Unfilled placeholder left in ${file}`);
    writeFileSync(path, text);
  }
  writeFileSync(join(out, ".htaccess"), htaccess(readFileSync(confPath, "utf8")));
}

if (import.meta.main) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error("Usage: npm run standalone -- <out-dir>");
    process.exit(1);
  }
  const site = siteSettings();
  buildStandalone("dist", outDir, site, "site.conf");
  console.log(`Standalone site for ${JSON.stringify(site.name)} in ${outDir}`);
}

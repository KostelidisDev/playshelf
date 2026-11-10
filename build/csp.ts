/* Reads the Content-Security-Policy that Apache sends from site.conf, so
 * `npm run preview` serves the build under the same policy and violations
 * show up before a deploy. */

import { readFileSync } from "node:fs";

function confText(confPath: string): string {
  return readFileSync(confPath, "utf8");
}

/** The policy for the site: the top-level header in site.conf. */
export function sitePolicy(confPath: string): string {
  const match = /^Header always set Content-Security-Policy "([^"]+)"$/m.exec(confText(confPath));
  if (!match?.[1]) throw new Error(`No Content-Security-Policy header in ${confPath}`);
  return match[1];
}

/** The policy for the catalog editor at /studio/: the one in its Location
 * block, which allows the YouTube title lookup. */
export function studioPolicy(confPath: string): string {
  const match = /<Location "\/studio\/">\s*Header always set Content-Security-Policy "([^"]+)"\s*<\/Location>/.exec(confText(confPath));
  if (!match?.[1]) throw new Error(`No /studio/ Content-Security-Policy in ${confPath}`);
  return match[1];
}

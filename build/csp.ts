/* Reads the Content-Security-Policy that Apache sends from site.conf, so
 * `npm run preview` serves the build under the same policy and violations
 * show up before a deploy. */

import { readFileSync } from "node:fs";

export function sitePolicy(confPath: string): string {
  const match = /^Header always set Content-Security-Policy "([^"]+)"$/m.exec(readFileSync(confPath, "utf8"));
  if (!match?.[1]) throw new Error(`No Content-Security-Policy header in ${confPath}`);
  return match[1];
}

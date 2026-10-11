/** The name shown when the page has none filled in (in tests, or behind a
 * server that doesn't replace the placeholder). */
export const DEFAULT_BRAND = "PlayShelf";

/** An unreplaced placeholder, such as `__SITE_NAME__`. */
const PLACEHOLDER = /^__\w+__$/;

/** The site name, from `<meta name="application-name">`. The server
 * fills it in from SITE_NAME as the page is served (site.conf), so one
 * build serves any site. */
export function siteName(doc: Document = document): string {
  const name = doc.querySelector<HTMLMetaElement>('meta[name="application-name"]')?.content.trim();
  return name && !PLACEHOLDER.test(name) ? name : DEFAULT_BRAND;
}

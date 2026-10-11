/* Splitting the grid into pages, and the page numbers the pager shows. */

// A multiple of every --cols value in style.css (2, 4 and 8), so a full page
// always ends on a complete row.
export const PAGE_SIZE = 16;

export interface Page<T> {
  items: T[];
  /** The current page, clamped to 1..pages. */
  page: number;
  pages: number;
  /** 1-based position of the first item shown (0 when there are none). */
  first: number;
  last: number;
  total: number;
}

/** The given page of `items`, with `page` clamped into range. */
export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), pages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pages,
    first: items.length ? start + 1 : 0,
    last: Math.min(start + size, items.length),
    total: items.length,
  };
}

export const GAP = "…";
export type PageListItem = number | typeof GAP;

/** The page numbers to show: the first and last pages, and `siblings` pages
 * on either side of the current one, with "…" for the gaps. For example,
 * pageList(6, 22) is [1, "…", 5, 6, 7, "…", 22]. */
export function pageList(current: number, total: number, siblings = 1): PageListItem[] {
  const pages = new Set([1, total]);
  for (let p = current - siblings; p <= current + siblings; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const list: PageListItem[] = [];
  sorted.forEach((p, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && p - previous === 2) list.push(previous + 1); // a gap of one page shows the page
    else if (previous !== undefined && p - previous > 2) list.push(GAP);
    list.push(p);
  });
  return list;
}

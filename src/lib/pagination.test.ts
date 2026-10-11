import { describe, expect, it } from "vitest";
import { GAP, PAGE_SIZE, pageList, paginate } from "./pagination.ts";

const items = Array.from({ length: 40 }, (_, i) => i + 1);

describe("paginate", () => {
  it("divides evenly by every grid column count", () => {
    for (const cols of [2, 4, 8]) expect(PAGE_SIZE % cols).toBe(0);
  });

  it("returns the requested page and its range", () => {
    const page = paginate(items, 2);
    expect(page.items).toEqual(items.slice(16, 32));
    expect(page).toMatchObject({ page: 2, pages: 3, first: 17, last: 32, total: 40 });
  });

  it("clamps out-of-range and invalid pages", () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, 1.5).page).toBe(1);
  });

  it("has one empty page when there are no items", () => {
    expect(paginate([], 3)).toMatchObject({ items: [], page: 1, pages: 1, first: 0, last: 0, total: 0 });
  });
});

describe("pageList", () => {
  it("shows ends, neighbours and gaps", () => {
    expect(pageList(6, 22)).toEqual([1, GAP, 5, 6, 7, GAP, 22]);
  });

  it("fills a one-page gap with the page itself", () => {
    expect(pageList(4, 10)).toEqual([1, 2, 3, 4, 5, GAP, 10]);
  });

  it("handles a single page and the edges", () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(1, 3)).toEqual([1, 2, 3]);
    expect(pageList(10, 10)).toEqual([1, GAP, 9, 10]);
  });
});

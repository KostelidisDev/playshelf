import type { ReactNode } from "react";
import { useDocumentKeydown } from "../hooks/useDocumentKeydown.ts";
import { isShortcutKey } from "../lib/events.ts";
import { PAGE_SIZE, type Page } from "../lib/pagination.ts";
import { SkeletonCard } from "./Card.tsx";
import { Pager } from "./Pager.tsx";

interface Props<T> {
  page: Page<T>;
  renderItem: (item: T) => ReactNode;
  urlFor: (page: number) => string;
  onNavigate: (url: string) => void;
}

/** One page of cards and the pager below it. The ← and → keys change page,
 * except while typing in a field. */
export function PagedGrid<T>({ page, renderItem, urlFor, onNavigate }: Props<T>) {
  useDocumentKeydown((event) => {
    if (!isShortcutKey(event)) return;
    const target = event.key === "ArrowLeft" ? page.page - 1 : event.key === "ArrowRight" ? page.page + 1 : 0;
    if (target < 1 || target > page.pages) return;
    event.preventDefault();
    onNavigate(urlFor(target));
  });

  return (
    <>
      <div className="grid">{page.items.map(renderItem)}</div>
      <Pager page={page} urlFor={urlFor} onNavigate={onNavigate} />
    </>
  );
}

/** Placeholder cards while the catalog loads. */
export function LoadingGrid({ count = PAGE_SIZE }: { count?: number }) {
  return <div className="grid">{Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}</div>;
}

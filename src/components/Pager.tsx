import { GAP, pageList, type Page } from "../lib/pagination.ts";
import { AppLink } from "./AppLink.tsx";

interface Props {
  page: Pick<Page<unknown>, "page" | "pages" | "first" | "last" | "total">;
  urlFor: (page: number) => string;
  onNavigate: (url: string) => void;
}

/** The pager under the grid. Each page is a real link (?p=N). */
export function Pager({ page: info, urlFor, onNavigate }: Props) {
  if (info.pages <= 1) return null;
  const prev = info.page > 1 ? urlFor(info.page - 1) : null;
  const next = info.page < info.pages ? urlFor(info.page + 1) : null;

  return (
    <nav className="pager" aria-label="Pages">
      <div className="pager-pages">
        <Arrow symbol="‹" label="Previous page" rel="prev" url={prev} onNavigate={onNavigate} />
        {pageList(info.page, info.pages).map((item, i) =>
          item === GAP
            ? <span key={`gap-${i}`} className="pager-gap">…</span>
            : (
              <AppLink
                key={item}
                className="pager-btn"
                href={urlFor(item)}
                onNavigate={onNavigate}
                aria-label={`Page ${item}`}
                aria-current={item === info.page ? "page" : undefined}
              >
                {item}
              </AppLink>
            ))}
        <Arrow symbol="›" label="Next page" rel="next" url={next} onNavigate={onNavigate} />
      </div>
      <p className="pager-summary">{`${info.first}–${info.last} of ${info.total}`}</p>
    </nav>
  );
}

function Arrow({ symbol, label, rel, url, onNavigate }: {
  symbol: string;
  label: string;
  rel: "prev" | "next";
  url: string | null;
  onNavigate: (url: string) => void;
}) {
  if (!url) return <span className="pager-btn pager-arrow" aria-disabled="true" aria-label={label}>{symbol}</span>;
  return <AppLink className="pager-btn pager-arrow" href={url} rel={rel} aria-label={label} onNavigate={onNavigate}>{symbol}</AppLink>;
}

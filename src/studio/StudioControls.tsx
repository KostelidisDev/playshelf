/* The small controls of the catalog editor: a row's buttons, the pager under
 * a list, and the file picker styled as a button. They hold no state of
 * their own; StudioApp decides what they do. */

import type { ChangeEvent, ReactNode } from "react";
import { GAP, pageList, type Page } from "../lib/pagination.ts";

/** Edit and Delete for one row. Both are off while another row's form is open. */
export function RowButtons({ label, disabled, onEdit, onDelete }: {
  label: string;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="studio-actions">
      <button className="btn btn-secondary btn-small" type="button" disabled={disabled} aria-label={`Edit ${label}`} onClick={onEdit}>
        Edit
      </button>
      <button className="btn btn-secondary btn-small" type="button" disabled={disabled} aria-label={`Delete ${label}`} onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

/** The site's pager, under a list: the same markup and styles (style.css),
 * with buttons in place of links. Nothing is shown when there's one page. */
export function Pager({ info, onPage }: { info: Pick<Page<unknown>, "page" | "pages" | "first" | "last" | "total">; onPage: (page: number) => void }) {
  const { page, pages } = info;
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      <div className="pager-pages">
        <PagerArrow symbol="‹" label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)} />
        {pageList(page, pages).map((item, i) =>
          item === GAP
            ? <span key={`gap-${i}`} className="pager-gap">…</span>
            : (
              <button
                key={item}
                type="button"
                className="pager-btn"
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPage(item)}
              >
                {item}
              </button>
            ))}
        <PagerArrow symbol="›" label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)} />
      </div>
      <p className="pager-summary">{`${info.first}–${info.last} of ${info.total}`}</p>
    </nav>
  );
}

function PagerArrow({ symbol, label, disabled, onClick }: { symbol: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="pager-btn pager-arrow" aria-label={label} disabled={disabled} onClick={onClick}>
      {symbol}
    </button>
  );
}

/** A file picker styled as a button. The input is visually hidden but still
 * reachable from the keyboard, and the label says what it does. */
export function OpenButton({ label, primary, onFile }: {
  label: string;
  primary?: boolean | undefined;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={primary ? "btn file-button" : "btn btn-secondary file-button"}>
      <input type="file" accept=".txt,.csv,text/plain,text/csv" className="visually-hidden" onChange={onFile} />
      {label}
    </label>
  );
}

/** The colour of an icon button: white for opening, green for saving. */
export type IconTone = "white" | "green";

/** A file picker as an icon in a round button. The label is kept for screen
 * readers and as the tooltip, so the button still says what it does. */
export function IconOpenButton({ label, icon, tone, onFile }: {
  label: string;
  icon: ReactNode;
  tone?: IconTone | undefined;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={tone ? `icon-btn file-button icon-btn-${tone}` : "icon-btn file-button"} title={label}>
      <input type="file" accept=".txt,.csv,text/plain,text/csv" className="visually-hidden" onChange={onFile} />
      {icon}
      <span className="visually-hidden">{label}</span>
    </label>
  );
}

/** An icon in a round button, for an action with a label for screen readers and a tooltip. */
export function IconButton({ label, icon, disabled, tone, onClick }: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  tone?: IconTone | undefined;
  onClick: () => void;
}) {
  return (
    <button
      className={tone ? `icon-btn icon-btn-${tone}` : "icon-btn"}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

/* The small controls of the catalog editor: a row's buttons, the pager under
 * a list, and the file picker styled as a button. They hold no state of
 * their own; StudioApp decides what they do. */

import type { ChangeEvent } from "react";

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

/** Previous and Next under a list. Nothing is shown when there's one page. */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="studio-pager" aria-label="Pages">
      <button className="btn btn-secondary btn-small" type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-secondary btn-small" type="button" disabled={page === pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
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

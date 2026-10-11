import type { ReactNode } from "react";

/** A centred note shown instead of the grid (errors, no results). */
export function Message({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="message">
      <p>{text}</p>
      {children}
    </div>
  );
}

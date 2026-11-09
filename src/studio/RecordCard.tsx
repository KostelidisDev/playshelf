import { useRef, type ReactNode } from "react";
import { Picture } from "../components/Card.tsx";

/** A game or video in the editor's grid: the site's card, with its picture
 * and tint, and the row's buttons under the text. Not a link: the editor
 * changes rows with the buttons. */
export function RecordCard({ variant, title, meta, images, children }: {
  variant: "game" | "video";
  title: string;
  meta: ReactNode;
  images: readonly string[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  return (
    <li ref={ref} className={`card card-${variant} studio-card`}>
      <Picture images={images} card={ref} />
      <div className="card-body">
        <p className="card-title">{title}</p>
        <div className="card-meta studio-meta">{meta}</div>
        {children}
      </div>
    </li>
  );
}

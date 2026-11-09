import { memo, useRef, useState, type ReactNode, type RefObject } from "react";
import { tints } from "../ui/tint.ts";
import { AppLink } from "./AppLink.tsx";

interface Props {
  href: string;
  title: string;
  meta: ReactNode;
  variant: "game" | "video";
  /** Image sources, in the order to try them. A game's cover comes first,
   * then its newest video's thumbnails. With none left to load, the card
   * shows a blank picture. */
  images: readonly string[];
  /** Opens in a new tab (YouTube); otherwise plain clicks go to `onNavigate`. */
  external?: boolean;
  onNavigate?: (href: string) => void;
}

/** A card that links somewhere: picture, title and a meta line. */
export const Card = memo(function Card({ href, title, meta, variant, images, external = false, onNavigate }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const body = (
    <>
      <Picture images={images} card={ref} />
      <div className="card-body">
        <p className="card-title">{title}</p>
        <div className="card-meta">{meta}</div>
      </div>
    </>
  );
  const className = `card card-${variant}`;
  if (external || !onNavigate) {
    return (
      <a ref={ref} className={className} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {body}
      </a>
    );
  }
  return <AppLink ref={ref} className={className} href={href} onNavigate={onNavigate}>{body}</AppLink>;
});

/** The first of `images` that loads. The area shimmers (.loading) until an
 * image loads or every source has failed. */
export function Picture({ images, card }: { images: readonly string[]; card: RefObject<HTMLElement | null> }) {
  // Keyed on the sources, so a card whose sources change starts again.
  return <Attempt key={images.join("|")} images={images} card={card} />;
}

function Attempt({ images, card }: { images: readonly string[]; card: RefObject<HTMLElement | null> }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = images[index];

  if (src === undefined) return <div className="card-thumb" />;
  return (
    <div className={loaded ? "card-thumb" : "card-thumb loading"}>
      <img
        src={src}
        alt=""
        width={480}
        height={270}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          setLoaded(true);
          if (card.current) tints.request(event.currentTarget, card.current);
        }}
        onError={() => setIndex((i) => i + 1)}
      />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card skeleton" aria-hidden="true">
      <div className="card-thumb" />
      <div className="card-body">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </div>
  );
}

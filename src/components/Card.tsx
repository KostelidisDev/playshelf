import { memo, useRef, useState, type ReactNode, type RefObject } from "react";
import { remoteThumbnailUrl, thumbnailUrl, type Video } from "../lib/videos.ts";
import { tints } from "../ui/tint.ts";
import { AppLink } from "./AppLink.tsx";

interface Props {
  href: string;
  /** The video whose thumbnail the card shows. */
  video: Video;
  title: string;
  meta: ReactNode;
  variant: "game" | "video";
  /** Opens in a new tab (YouTube); otherwise plain clicks go to `onNavigate`. */
  external?: boolean;
  onNavigate?: (href: string) => void;
}

/** A card that links somewhere: thumbnail, title and a meta line. */
export const Card = memo(function Card({ href, video, title, meta, variant, external = false, onNavigate }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const body = (
    <>
      <Thumbnail video={video} card={ref} />
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

/** The site's WebP thumbnail (downloaded by sync-thumbnails.sh), or
 * YouTube's own until that exists. The area shimmers (.loading) until an
 * image loads or both fail. */
function Thumbnail({ video, card }: { video: Video; card: RefObject<HTMLAnchorElement | null> }) {
  const [src, setSrc] = useState(() => thumbnailUrl(video));
  const [settled, setSettled] = useState(false);
  const remote = remoteThumbnailUrl(video);

  return (
    <div className={settled ? "card-thumb" : "card-thumb loading"}>
      <img
        src={src}
        alt=""
        width={480}
        height={270}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          setSettled(true);
          if (card.current) tints.request(event.currentTarget, card.current);
        }}
        onError={() => {
          if (src === remote) setSettled(true);
          else setSrc(remote);
        }}
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

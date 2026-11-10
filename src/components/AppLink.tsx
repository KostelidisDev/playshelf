import type { ComponentPropsWithRef, MouseEvent } from "react";
import { isPlainClick } from "../lib/events.ts";
import { isSafeHref } from "../lib/routes.ts";

type Props = ComponentPropsWithRef<"a"> & {
  href: string;
  /** Handles a plain click in the app, instead of loading a page. */
  onNavigate: (href: string) => void;
};

/** A real link, which can be opened in a new tab, copied or bookmarked,
 * whose plain clicks the app handles itself. */
export function AppLink({ href, onNavigate, onClick, ...rest }: Props) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isPlainClick(event)) return;
    event.preventDefault();
    if (isSafeHref(href)) onNavigate(href);
  };
  // An address that isn't safe renders as a link with no target, so it can't run anything.
  return <a href={isSafeHref(href) ? href : undefined} onClick={handleClick} {...rest} />;
}

import type { ComponentPropsWithRef, MouseEvent } from "react";
import { isPlainClick } from "../lib/events.ts";

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
    onNavigate(href);
  };
  return <a href={href} onClick={handleClick} {...rest} />;
}

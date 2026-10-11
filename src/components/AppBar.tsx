import { useRef, type MouseEvent, type ReactNode } from "react";
import { useHeaderHeight } from "../hooks/useHeaderHeight.ts";
import { useInstallPrompt } from "../hooks/useInstallPrompt.ts";
import { isPlainClick } from "../lib/events.ts";
import { channelName } from "../ui/brand.ts";
import { buildVersion } from "../ui/version.ts";
import { BackIcon, GamepadIcon, InstallIcon } from "./Icons.tsx";

export const BRAND = channelName();

interface Props {
  view: "home" | "game";
  status: string;
  /** A plain click on the brand: clears the filters on the home view, or
   * goes back on a game page. */
  onBrandClick: () => void;
  /** The search box and letter strip, on the home view. */
  children?: ReactNode;
}

export function AppBar({ view, status, onBrandClick, children }: Props) {
  const header = useRef<HTMLElement>(null);
  useHeaderHeight(header);
  const install = useInstallPrompt();
  const version = buildVersion();

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onBrandClick();
  };

  return (
    <header ref={header} className="appbar">
      <div className="appbar-row">
        <a className="brand" href="./" aria-label={view === "home" ? BRAND : "Back to all games"} onClick={handleBrandClick}>
          <GamepadIcon />
          <BackIcon />
          <span className="brand-text">
            <span>{BRAND}</span>
            {version && <span className="version" title={`Version ${version}`}>{version}</span>}
          </span>
        </a>
        <span className="status" role="status" aria-live="polite">{status}</span>
        {install && (
          <button className="install-btn" type="button" onClick={install}>
            <InstallIcon />
            Install
          </button>
        )}
      </div>
      {children && <div className="toolbar">{children}</div>}
    </header>
  );
}

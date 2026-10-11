/// <reference types="vite/client" />

/** Filled in by vite.config.ts at build time. */
declare const __APP_VERSION__: string;

/** Chromium's install prompt event, which lib.dom doesn't include. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

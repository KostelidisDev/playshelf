interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** A left click with no modifier keys, which the app handles itself. Any
 * other click (new tab, new window, download) is left to the browser. */
export function isPlainClick(event: ClickLike): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

interface KeyLike {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

/** A key pressed without modifiers and outside any text field, so it can
 * act as a shortcut. */
export function isShortcutKey(event: KeyLike): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const target = event.target as Element | null;
  return !target?.closest?.("input, textarea, select, [contenteditable]");
}

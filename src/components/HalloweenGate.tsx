/* Loads the Halloween easter egg (Halloween.tsx) only when it's needed: on
 * October 31, or once "boo" is typed. Until then the page carries just this
 * listener, not the code, the bats or the masks. The chunk is precached by
 * the service worker, so the egg still works offline once it has been seen. */

import { lazy, Suspense, useRef, useState } from "react";
import { useDocumentKeydown } from "../hooks/useDocumentKeydown.ts";
import { isShortcutKey } from "../lib/events.ts";
import { isHalloween, nextSpell, SPELL } from "../lib/halloween.ts";

const Halloween = lazy(() => import("./Halloween.tsx").then((module) => ({ default: module.Halloween })));

/** "date": on from the start (October 31). "spell": "boo" was typed, so
 * the egg loads and toggles on at once. */
type Start = "date" | "spell" | null;

export function HalloweenGate() {
  const [start, setStart] = useState<Start>(() => (isHalloween(new Date()) ? "date" : null));
  const typed = useRef("");

  useDocumentKeydown((event) => {
    if (start !== null || !isShortcutKey(event)) return;
    typed.current = nextSpell(typed.current, event.key);
    if (typed.current === SPELL) {
      typed.current = "";
      setStart("spell");
    }
  });

  if (start === null) return null;
  return (
    <Suspense fallback={null}>
      <Halloween toggleOnMount={start === "spell"} />
    </Suspense>
  );
}

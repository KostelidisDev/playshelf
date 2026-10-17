/* The Halloween easter egg (lib/halloween.ts). While it's on, `data-halloween`
 * on <html> turns the accent blood red (style.css), swaps the logo and the
 * tab's icon for a skull, and darkens the page at the edges. For the first
 * few seconds, blood soaks the top of the screen and drips from it,
 * splatters and handprints land, and "Happy Halloween" rises out of the
 * dark; then it all fades away. Red-eyed bats keep
 * crossing the page, and masks keep looming faintly out of the dark, one
 * at a time. Then the jump scare: one of the masks, picked at
 * random, lunges at the screen with a shriek (ui/shriek.ts), right away
 * when "boo" is typed, or once, a little while after the page opens, on
 * October 31 itself.
 *
 * It's decoration only: hidden from screen readers and never in the way of
 * a click. Users who asked for less motion get the colour and the darkness,
 * but no animation and no scare. */

import { useEffect, useRef, useState } from "react";
import { useDocumentKeydown } from "../hooks/useDocumentKeydown.ts";
import { isShortcutKey } from "../lib/events.ts";
import { isHalloween, nextSpell, SPELL } from "../lib/halloween.ts";
import { shriek as defaultShriek } from "../ui/shriek.ts";
import doll from "./halloween/doll.svg";
import ghoul from "./halloween/ghoul.svg";
import hand from "./halloween/hand.svg";
import hockey from "./halloween/hockey.svg";
import sack from "./halloween/sack.svg";
import skull from "./halloween/skull.svg";
import splatter from "./halloween/splatter.svg";

export const MASKS = [ghoul, doll, sack, hockey];
const BATS = 4;
const DRIPS = 12;
const SPLATTERS = 4;
const HANDS = 2;
/** How long the face stays; matches the `scare` animation in style.css. */
export const SCARE_MS = 1400;
/** How long the blood lasts after the easter egg turns on; matches
 * --bleed in style.css. */
export const BLOOD_MS = 5000;
/** On October 31, how long the visitor is left in peace before the scare. */
export const AMBUSH_MS = 25_000;

interface Props {
  /** For tests: the day to check. */
  now?: () => Date;
  /** For tests: the sound of the scare. */
  shriek?: () => void;
  /** For tests: a number in [0, 1) that picks the mask of the scare. */
  random?: () => number;
}

function wantsLessMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function Halloween({ now = () => new Date(), shriek = defaultShriek, random = Math.random }: Props) {
  const [on, setOn] = useState(() => isHalloween(now()));
  /** The mask of the scare in progress, if any. */
  const [scaring, setScaring] = useState<string | null>(null);
  const [bleeding, setBleeding] = useState(on);
  const typed = useRef("");
  const scared = useRef(false);

  const scare = () => {
    scared.current = true;
    if (wantsLessMotion()) return;
    setScaring(MASKS[Math.floor(random() * MASKS.length)] ?? ghoul);
    shriek();
  };

  useDocumentKeydown((event) => {
    if (!isShortcutKey(event)) return;
    typed.current = nextSpell(typed.current, event.key);
    if (typed.current === SPELL) {
      typed.current = "";
      if (!on) scare();
      setOn(!on);
      setBleeding(!on);
    }
  });

  useEffect(() => {
    document.documentElement.toggleAttribute("data-halloween", on);
    if (!on) return;
    // Fetch the masks ahead of time: a scare that loads in late isn't one.
    for (const mask of MASKS) new Image().src = mask;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    const href = icon?.getAttribute("href");
    icon?.setAttribute("href", skull);
    return () => {
      document.documentElement.removeAttribute("data-halloween");
      if (href) icon?.setAttribute("href", href);
    };
  }, [on]);

  // The ambush comes once per visit, and not at all if "boo" got there first.
  const ambush = useRef(scare);
  useEffect(() => { ambush.current = scare; });
  useEffect(() => {
    if (!on || scared.current) return;
    const timer = setTimeout(() => { if (!scared.current) ambush.current(); }, AMBUSH_MS);
    return () => clearTimeout(timer);
  }, [on]);

  useEffect(() => {
    if (!bleeding) return;
    const timer = setTimeout(() => setBleeding(false), BLOOD_MS);
    return () => clearTimeout(timer);
  }, [bleeding]);

  useEffect(() => {
    if (!scaring) return;
    const timer = setTimeout(() => setScaring(null), SCARE_MS);
    return () => clearTimeout(timer);
  }, [scaring]);

  return (
    <>
      {on && (
        <div className="haunt" aria-hidden="true">
          <div className="lurkers">
            {MASKS.map((mask) => <img key={mask} className="lurker" src={mask} alt="" />)}
          </div>
          {bleeding && (
            <div className="blood">
              <div className="stains">
                {Array.from({ length: SPLATTERS }, (_, i) => <img key={i} className="splatter" src={splatter} alt="" />)}
                {Array.from({ length: HANDS }, (_, i) => <img key={i} className="hand" src={hand} alt="" />)}
              </div>
              <div className="drips">
                {Array.from({ length: DRIPS }, (_, i) => <span key={i} className="drip" />)}
              </div>
              <div className="blood-edge" />
              <p className="greeting">Happy Halloween</p>
            </div>
          )}
          <div className="bats">
            {Array.from({ length: BATS }, (_, i) => (
              <svg key={i} className="bat" viewBox="0 0 64 32">
                <path d="M32 9c-2 0-3 1.5-3.5 3L27 8l-1 5c-4-6-12-9-24-8 6 3 8 8 7 13 4-3 9-3 12 1 2-3 6-3 8 0l3 5 3-5c2-3 6-3 8 0 3-4 8-4 12-1-1-5 1-10 7-13-12-1-20 2-24 8l-1-5-1.5 4C35 10.5 34 9 32 9z" />
                <circle className="bat-eye" cx="30.2" cy="12.5" r="0.9" />
                <circle className="bat-eye" cx="33.8" cy="12.5" r="0.9" />
              </svg>
            ))}
          </div>
        </div>
      )}
      {scaring && <Face mask={scaring} />}
    </>
  );
}

/** The jump scare: `mask` lunging out of the dark. */
function Face({ mask }: { mask: string }) {
  return (
    <div className="scare" aria-hidden="true">
      <img className="scare-face" src={mask} alt="" />
    </div>
  );
}

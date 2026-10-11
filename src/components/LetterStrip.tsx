import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

interface Props {
  letters: readonly string[];
  active: string | null;
  /** The chosen letter, or null for all games. */
  onSelect: (letter: string | null) => void;
}

/** The A-Z index: a strip of letters in the app bar, centred when it fits.
 * When it doesn't, it scrolls with any input, not only touch and trackpads:
 * a mouse wheel scrolls it sideways, and the mouse can drag it. */
export function LetterStrip({ letters, active, onSelect }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { edges, dragging } = useStripScrolling(ref);

  // Scroll the active letter into view.
  useLayoutEffect(() => {
    const strip = ref.current;
    const button = strip?.querySelector<HTMLElement>(".active");
    if (!strip || !button || strip.scrollWidth <= strip.clientWidth) return;
    const left = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  const classes = ["letters", edges.start && "more-start", edges.end && "more-end", dragging && "dragging"];
  const button = (label: string, letter: string | null, title = label) => {
    const isActive = active === letter;
    return (
      <button
        key={letter ?? ""}
        type="button"
        className={isActive ? "letter-btn active" : "letter-btn"}
        title={title}
        aria-pressed={isActive}
        onClick={() => onSelect(isActive ? null : letter)}
      >
        {label}
      </button>
    );
  };

  return (
    <nav ref={ref} className={classes.filter(Boolean).join(" ")} aria-label="Filter games by first letter">
      {/* Always rendered, so the scrolling listeners have an element to
          attach to; empty (and hidden by CSS) until the catalog loads. */}
      {letters.length > 0 && [button("•", null, "All games"), ...letters.map((letter) => button(letter, letter))]}
    </nav>
  );
}

interface Edges {
  start: boolean;
  end: boolean;
}

/** Wheel and mouse-drag scrolling for the strip, and which of its edges
 * have more letters past them (for the fade). State changes only when an
 * edge flips, not on every scroll event. */
function useStripScrolling(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const scrollable = () => strip.scrollWidth > strip.clientWidth + 1 && getComputedStyle(strip).flexDirection !== "column";

    const updateEdges = () => {
      const more = scrollable();
      const start = more && strip.scrollLeft > 1;
      const end = more && strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1;
      setEdges((old) => (old.start === start && old.end === end ? old : { start, end }));
    };

    const onWheel = (event: WheelEvent) => {
      // Trackpads scroll sideways on their own (deltaX); only a plain wheel
      // is remapped.
      if (!scrollable() || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = strip.scrollWidth - strip.clientWidth;
      const atEdge = (event.deltaY < 0 && strip.scrollLeft <= 0) || (event.deltaY > 0 && strip.scrollLeft >= max - 1);
      if (atEdge) return; // past the end, the page scrolls instead
      event.preventDefault();
      strip.scrollLeft += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    };

    let drag: { x: number; left: number; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !scrollable()) return;
      drag = { x: event.clientX, left: strip.scrollLeft, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      if (!drag.moved) setDragging(true);
      drag.moved = true;
      strip.scrollLeft = drag.left - dx;
    };
    const swallowClick = (event: MouseEvent) => event.stopPropagation();
    const onPointerUp = () => {
      if (drag?.moved) {
        // The click that ends a drag mustn't pick a letter.
        strip.addEventListener("click", swallowClick, { capture: true, once: true });
        setTimeout(() => {
          strip.removeEventListener("click", swallowClick, { capture: true });
          setDragging(false);
        });
      }
      drag = null;
    };

    strip.addEventListener("scroll", updateEdges, { passive: true });
    strip.addEventListener("wheel", onWheel, { passive: false });
    strip.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    const resize = new ResizeObserver(updateEdges);
    resize.observe(strip);
    const mutations = new MutationObserver(updateEdges);
    mutations.observe(strip, { childList: true });
    updateEdges();

    return () => {
      strip.removeEventListener("scroll", updateEdges);
      strip.removeEventListener("wheel", onWheel);
      strip.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [ref]);

  return { edges, dragging };
}

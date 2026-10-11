/* Tints each card's body with two colours from its thumbnail: the
 * bottom-left and bottom-right pixels, next to the body, as --tint-a and
 * --tint-b. The gradient stands in for a live blur of the image. It's
 * computed once per image in idle time, where a CSS filter would be redrawn
 * while scrolling. The properties are set on the element through the CSSOM
 * (which the CSP allows), not through React state, so no card re-renders. */

const DARKEN = 0.5;  // so light thumbnails don't wash out the text
const ALPHA = 0.7;
const BUDGET_MS = 6; // work per slice without requestIdleCallback
const MIN_BATCH = 4; // images per slice, even with no idle time left

export type Tint = readonly [string, string];

interface Deadline {
  timeRemaining(): number;
}

type Idle = (callback: (deadline: Deadline) => void) => void;

const defaultIdle: Idle = (callback) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(callback, { timeout: 500 });
  else setTimeout(() => callback({ timeRemaining: () => BUDGET_MS }), 30);
};

/** The pixel at `offset`, darkened, as "rgb(r g b / a)". */
export function tintColor(data: ArrayLike<number>, offset: number): string {
  const [r, g, b] = [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0].map((v) => Math.round(v * DARKEN));
  return `rgb(${r} ${g} ${b} / ${ALPHA})`;
}

/** Sets the tint on `target`; null leaves it untinted. */
export function applyTint(target: HTMLElement, tint: Tint | null): void {
  if (!tint) return;
  target.style.setProperty("--tint-a", tint[0]);
  target.style.setProperty("--tint-b", tint[1]);
}

export class TintSampler {
  private context: CanvasRenderingContext2D | null | undefined;
  private readonly cache = new Map<string, Tint | null>(); // by image URL
  private queue: { img: HTMLImageElement; target: HTMLElement }[] = [];
  private scheduled = false;

  constructor(private readonly idle: Idle = defaultIdle) {}

  /** Tints `target` from `img`, which must have loaded, during idle time. */
  request(img: HTMLImageElement, target: HTMLElement): void {
    const cached = this.cache.get(img.currentSrc || img.src);
    if (cached !== undefined) {
      applyTint(target, cached);
      return;
    }
    this.queue.push({ img, target });
    if (!this.scheduled) {
      this.scheduled = true;
      this.idle((deadline) => this.drain(deadline));
    }
  }

  private drain(deadline: Deadline): void {
    // A callback run by its timeout has no idle time left (timeRemaining()
    // is 0), so each slice does at least a small batch.
    let done = 0;
    while (this.queue.length && (done < MIN_BATCH || deadline.timeRemaining() > 1)) {
      done++;
      const { img, target } = this.queue.shift()!;
      // Skip cards that have left the page since.
      if (!target.isConnected) continue;
      const key = img.currentSrc || img.src;
      if (!this.cache.has(key)) this.cache.set(key, this.sample(img));
      applyTint(target, this.cache.get(key) ?? null);
    }
    if (this.queue.length) this.idle((next) => this.drain(next));
    else this.scheduled = false;
  }

  private getContext(): CanvasRenderingContext2D | null {
    if (this.context === undefined) {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      try {
        this.context = canvas.getContext("2d", { willReadFrequently: true });
      } catch {
        this.context = null;
      }
    }
    return this.context;
  }

  private sample(img: HTMLImageElement): Tint | null {
    const context = this.getContext();
    if (!context) return null;
    try {
      context.clearRect(0, 0, 2, 2);
      context.drawImage(img, 0, 0, 2, 2);
      const { data } = context.getImageData(0, 0, 2, 2);
      return [tintColor(data, 8), tintColor(data, 12)]; // bottom row: left, right
    } catch {
      // YouTube's thumbnail is cross-origin and taints the canvas; that card
      // keeps the neutral glass.
      return null;
    }
  }
}

export const tints = new TintSampler();

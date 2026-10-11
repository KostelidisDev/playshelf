import { describe, expect, it } from "vitest";
import { applyTint, tintColor, TintSampler } from "./tint.ts";

describe("tintColor", () => {
  it("darkens the pixel by half and adds alpha", () => {
    expect(tintColor([200, 100, 51, 255], 0)).toBe("rgb(100 50 26 / 0.7)");
  });
});

describe("applyTint", () => {
  it("sets both custom properties, or nothing for null", () => {
    const el = document.createElement("div");
    applyTint(el, null);
    expect(el.style.getPropertyValue("--tint-a")).toBe("");
    applyTint(el, ["red", "blue"]);
    expect(el.style.getPropertyValue("--tint-a")).toBe("red");
    expect(el.style.getPropertyValue("--tint-b")).toBe("blue");
  });
});

describe("TintSampler", () => {
  it("leaves the card untinted when there is no canvas", () => {
    const queued: ((d: { timeRemaining(): number }) => void)[] = [];
    const sampler = new TintSampler((cb) => queued.push(cb));
    const img = document.createElement("img");
    img.src = "https://site.test/a.webp";
    const target = document.createElement("a");
    document.body.append(target);
    sampler.request(img, target);
    expect(queued).toHaveLength(1);
    queued[0]!({ timeRemaining: () => 10 });
    expect(target.style.getPropertyValue("--tint-a")).toBe("");
    target.remove();
  });
});

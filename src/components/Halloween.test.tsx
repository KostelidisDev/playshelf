import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AMBUSH_MS, BLOOD_MS, Halloween, MASKS, SCARE_MS } from "./Halloween.tsx";

const root = document.documentElement;
const type = (word: string, target: Element = document.body) => {
  for (const key of word) fireEvent.keyDown(target, { key });
};
const october31 = () => new Date(2026, 9, 31);
const june1 = () => new Date(2026, 5, 1);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Halloween", () => {
  it("is on by itself on October 31", () => {
    const { container, unmount } = render(<Halloween now={october31} shriek={vi.fn()} />);
    expect(root.hasAttribute("data-halloween")).toBe(true);
    expect(container.querySelectorAll(".bat")).toHaveLength(4);
    expect(container.querySelectorAll(".drip")).toHaveLength(12);
    expect(container.querySelectorAll(".lurker")).toHaveLength(MASKS.length);
    expect(container.querySelectorAll(".splatter, .hand")).toHaveLength(6);
    unmount();
    expect(root.hasAttribute("data-halloween")).toBe(false);
  });

  it("bleeds and greets for a few seconds, and keeps the masks", () => {
    vi.useFakeTimers();
    const { container } = render(<Halloween now={june1} shriek={vi.fn()} />);
    type("boo");
    expect(container.querySelectorAll(".drip")).toHaveLength(12);
    expect(container).toHaveTextContent("Happy Halloween");
    act(() => { vi.advanceTimersByTime(BLOOD_MS); });
    expect(container.querySelector(".blood")).toBeNull();
    expect(container).not.toHaveTextContent("Happy Halloween");
    expect(container.querySelectorAll(".lurker")).toHaveLength(MASKS.length);

    type("boo");
    type("boo");
    expect(container.querySelector(".blood")).not.toBeNull();
  });

  it("puts a skull on the tab while it's on", () => {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.setAttribute("href", "/assets/icons/icon.svg");
    document.head.append(icon);

    const { unmount } = render(<Halloween now={october31} shriek={vi.fn()} />);
    expect(icon.getAttribute("href")).toMatch(/skull/);
    unmount();
    expect(icon.getAttribute("href")).toBe("/assets/icons/icon.svg");
    icon.remove();
  });

  it("toggles when 'boo' is typed outside a text field", () => {
    const { container, unmount } = render(<Halloween now={june1} shriek={vi.fn()} />);
    expect(root.hasAttribute("data-halloween")).toBe(false);
    type("boo");
    expect(root.hasAttribute("data-halloween")).toBe(true);
    expect(container.querySelector(".haunt")).not.toBeNull();
    type("boo");
    expect(root.hasAttribute("data-halloween")).toBe(false);

    const input = document.createElement("input");
    document.body.append(input);
    type("boo", input);
    expect(root.hasAttribute("data-halloween")).toBe(false);
    input.remove();
    unmount();
  });

  it("jumps out with a shriek when turned on, and only then", () => {
    vi.useFakeTimers();
    const shriek = vi.fn();
    const { container } = render(<Halloween now={june1} shriek={shriek} random={() => 0.99} />);
    type("boo");
    expect(container.querySelector(".scare-face")).toHaveAttribute("src", MASKS.at(-1));
    expect(shriek).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(SCARE_MS); });
    expect(container.querySelector(".scare")).toBeNull();

    type("boo");
    expect(container.querySelector(".scare")).toBeNull();
    expect(shriek).toHaveBeenCalledTimes(1);
  });

  it("lies in wait on October 31, then scares once", () => {
    vi.useFakeTimers();
    const shriek = vi.fn();
    const { container } = render(<Halloween now={october31} shriek={shriek} />);
    expect(container.querySelector(".scare")).toBeNull();
    act(() => { vi.advanceTimersByTime(AMBUSH_MS); });
    expect(container.querySelector(".scare")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(SCARE_MS + AMBUSH_MS); });
    expect(container.querySelector(".scare")).toBeNull();
    expect(shriek).toHaveBeenCalledTimes(1);
  });

  it("never scares users who asked for less motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const shriek = vi.fn();
    const { container } = render(<Halloween now={october31} shriek={shriek} />);
    act(() => { vi.advanceTimersByTime(AMBUSH_MS); });
    type("boo");
    type("boo");
    expect(container.querySelector(".scare")).toBeNull();
    expect(shriek).not.toHaveBeenCalled();
    expect(root.hasAttribute("data-halloween")).toBe(true);
  });
});

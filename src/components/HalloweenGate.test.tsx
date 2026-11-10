import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HalloweenGate } from "./HalloweenGate.tsx";

const root = document.documentElement;
const type = (word: string) => {
  for (const key of word) fireEvent.keyDown(document.body, { key });
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  root.removeAttribute("data-halloween");
});

describe("HalloweenGate", () => {
  it("renders nothing on an ordinary day until \"boo\" is typed", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 5, 1));
    const { container } = render(<HalloweenGate />);
    type("hello");
    expect(container).toBeEmptyDOMElement();
    expect(root.hasAttribute("data-halloween")).toBe(false);
  });

  it("turns the egg on with the first \"boo\", loading it on demand", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 5, 1));
    const { container } = render(<HalloweenGate />);
    type("boo");
    await waitFor(() => expect(root.hasAttribute("data-halloween")).toBe(true));
    expect(container.querySelectorAll(".bat")).toHaveLength(4);
    // A second "boo" turns it off again, through the loaded component.
    type("boo");
    await waitFor(() => expect(root.hasAttribute("data-halloween")).toBe(false));
  });

  it("is on from the start on October 31", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 31));
    render(<HalloweenGate />);
    await waitFor(() => expect(root.hasAttribute("data-halloween")).toBe(true));
    expect(screen.getByText("Happy Halloween", { exact: false })).toBeInTheDocument();
  });
});

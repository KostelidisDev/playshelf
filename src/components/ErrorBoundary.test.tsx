import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

function Broken(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the error it caught; the test checks for it rather than
    // letting it print.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders its children when nothing throws", () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows a note, and logs the error, when a child throws", () => {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });
});

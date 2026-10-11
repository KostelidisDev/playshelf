import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paginate } from "../lib/pagination.ts";
import { Pager } from "./Pager.tsx";

const items = Array.from({ length: 22 * 16 }, (_, i) => i);
const urlFor = (p: number) => `./?p=${p}`;

describe("Pager", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pager page={paginate(items.slice(0, 5), 1)} urlFor={urlFor} onNavigate={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows ends, neighbours and gaps, with real links", () => {
    render(<Pager page={paginate(items, 6)} urlFor={urlFor} onNavigate={() => {}} />);
    const labels = [...document.querySelectorAll(".pager-pages > *")].map((el) => el.textContent);
    expect(labels).toEqual(["‹", "1", "…", "5", "6", "7", "…", "22", "›"]);
    expect(screen.getByRole("link", { name: "Page 6" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "./?p=7");
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("rel", "prev");
    expect(screen.getByText("81–96 of 352")).toBeInTheDocument();
  });

  it("disables the arrow at either end", () => {
    render(<Pager page={paginate(items, 1)} urlFor={urlFor} onNavigate={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Previous page").tagName).toBe("SPAN");
  });
});

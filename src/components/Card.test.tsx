import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Card } from "./Card.tsx";

describe("Card", () => {
  const sources = ["assets/thumbnails/abc.webp", "https://i.ytimg.com/vi/abc/hqdefault.jpg"];

  it("tries each picture in turn, then shows a blank one and stops shimmering", () => {
    render(<Card href="https://example.test" title="T" meta="M" variant="video" images={sources} external />);
    const img = document.querySelector("img")!;
    const thumb = img.parentElement!;
    expect(img).toHaveAttribute("src", sources[0]);
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(thumb).toHaveClass("loading");

    fireEvent.error(img);
    expect(img).toHaveAttribute("src", sources[1]);
    expect(thumb).toHaveClass("loading");

    fireEvent.error(img);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector(".card-thumb")).not.toHaveClass("loading");
  });

  it("stops shimmering once the image loads", () => {
    render(<Card href="./?g=x" title="T" meta="M" variant="game" images={sources} onNavigate={() => {}} />);
    const img = document.querySelector("img")!;
    fireEvent.load(img);
    expect(img.parentElement).not.toHaveClass("loading");
  });

  it("starts again with the new pictures when they change", () => {
    const { rerender } = render(<Card href="./?g=x" title="T" meta="M" variant="game" images={[]} onNavigate={() => {}} />);
    expect(document.querySelector("img")).toBeNull();
    rerender(<Card href="./?g=x" title="T" meta="M" variant="game" images={["assets/thumbnails/games/x.webp"]} onNavigate={() => {}} />);
    expect(document.querySelector("img")).toHaveAttribute("src", "assets/thumbnails/games/x.webp");
  });

  it("hands plain clicks to onNavigate but leaves modified clicks to the browser", async () => {
    const onNavigate = vi.fn();
    render(<Card href="./?g=x" title="Title" meta="1 video" variant="game" images={sources} onNavigate={onNavigate} />);
    const link = screen.getByRole("link", { name: /Title/ });
    expect(link).toHaveClass("card", "card-game");

    await userEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("./?g=x");

    onNavigate.mockClear();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
    link.dispatchEvent(event);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

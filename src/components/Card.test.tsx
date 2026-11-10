import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeVideo } from "../test/fixtures.ts";
import { Card } from "./Card.tsx";

describe("Card", () => {
  const video = makeVideo("Game");

  it("loads the local thumbnail, falls back to YouTube, then stops shimmering", () => {
    render(<Card href="https://example.test" video={video} title="T" meta="M" variant="video" external />);
    const img = document.querySelector("img")!;
    const thumb = img.parentElement!;
    expect(img).toHaveAttribute("src", `assets/thumbnails/${video.id}.webp`);
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(thumb).toHaveClass("loading");

    fireEvent.error(img);
    expect(img).toHaveAttribute("src", `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
    expect(thumb).toHaveClass("loading");

    fireEvent.error(img);
    expect(thumb).not.toHaveClass("loading");
  });

  it("stops shimmering once the image loads", () => {
    render(<Card href="./?g=x" video={video} title="T" meta="M" variant="game" onNavigate={() => {}} />);
    const img = document.querySelector("img")!;
    fireEvent.load(img);
    expect(img.parentElement).not.toHaveClass("loading");
  });

  it("hands plain clicks to onNavigate but leaves modified clicks to the browser", async () => {
    const onNavigate = vi.fn();
    render(<Card href="./?g=x" video={video} title="Title" meta="1 video" variant="game" onNavigate={onNavigate} />);
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

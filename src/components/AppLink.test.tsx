import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppLink } from "./AppLink.tsx";

describe("AppLink", () => {
  it("keeps the address of a safe link and hands its plain clicks to the app", () => {
    const onNavigate = vi.fn();
    render(<AppLink href="./?g=abc" onNavigate={onNavigate}>Game</AppLink>);
    const link = screen.getByRole("link", { name: "Game" });
    expect(link).toHaveAttribute("href", "./?g=abc");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("./?g=abc");
  });

  it("renders no address and does not navigate for a script address", () => {
    const onNavigate = vi.fn();
    render(<AppLink href="javascript:alert(1)" onNavigate={onNavigate}>Bad</AppLink>);
    const link = screen.getByText("Bad");
    expect(link).not.toHaveAttribute("href");
    fireEvent.click(link);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

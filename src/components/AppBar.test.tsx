import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppBar } from "./AppBar.tsx";

function fakeInstallPrompt() {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(async () => {});
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }) });
  return { event, prompt };
}

describe("AppBar", () => {
  it("shows the brand, build version and status", () => {
    render(<AppBar view="home" status="3 games" onBrandClick={() => {}} />);
    expect(screen.getByRole("link", { name: "PlayShelf" })).toHaveAttribute("href", "./");
    expect(screen.getByTitle("Version dev")).toHaveTextContent("dev");
    expect(screen.getByRole("status")).toHaveTextContent("3 games");
  });

  it("is a back link on game pages", async () => {
    const onBrandClick = vi.fn();
    render(<AppBar view="game" status="" onBrandClick={onBrandClick} />);
    await userEvent.click(screen.getByRole("link", { name: "Back to all games" }));
    expect(onBrandClick).toHaveBeenCalledOnce();
  });

  it("offers Install only when the browser does, and hides it once used", async () => {
    render(<AppBar view="home" status="" onBrandClick={() => {}} />);
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();

    const { event, prompt } = fakeInstallPrompt();
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("hides Install after the app is installed", () => {
    render(<AppBar view="home" status="" onBrandClick={() => {}} />);
    act(() => { window.dispatchEvent(fakeInstallPrompt().event); });
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });
});

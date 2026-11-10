import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Draft, DraftStore } from "./draftStore.ts";
import { StudioApp } from "./StudioApp.tsx";

const GAMES_HEADER = "game_id,title";
const VIDEOS_HEADER = "video_id,title,published_at,game_ids";
const ID_A = "o9KQ4rlymEQ";
const ID_B = "2VawSnaxtSI";

const games = (...rows: string[]) => `${GAMES_HEADER}\n${rows.join("\n")}\n`;
const videos = (...rows: string[]) => `${VIDEOS_HEADER}\n${rows.join("\n")}\n`;
const file = (text: string, name: string) => new File([text], name, { type: "text/plain" });

const createObjectURL = vi.fn((_blob: Blob) => "blob:studio-test");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  // jsdom can't follow a download link; the tests read the file's blob instead.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

type User = ReturnType<typeof userEvent.setup>;

function renderEditor(): User {
  const user = userEvent.setup();
  render(<StudioApp />);
  return user;
}

/** Opens Games.txt and Videos.txt, and waits for the editor to take over. */
async function openBoth(user: User, gamesText: string, videosText: string) {
  await user.upload(screen.getByLabelText("Open Games.txt"), file(gamesText, "Games.txt"));
  await user.upload(screen.getByLabelText("Open Videos.txt"), file(videosText, "Videos.txt"));
  await waitFor(() => expect(screen.queryByRole("tablist")).toBeInTheDocument());
}

const listedTitles = () => [...document.querySelectorAll(".studio-card .card-title")].map((el) => el.textContent);
const statusText = () => screen.getByRole("status").textContent;

/** The text of an exported file. Read as bytes, keeping the byte order mark
 * (Blob.text() would drop it, as a browser's decoder does). */
async function exported(user: User, name: "Games.txt" | "Videos.txt"): Promise<string> {
  await user.click(screen.getByRole("button", { name: `Export ${name}` }));
  const blob = createObjectURL.mock.calls.at(-1)![0];
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await blob.arrayBuffer());
}

describe("StudioApp: start", () => {
  it("offers both files to open, or a new catalog", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "Edit the catalog" })).toBeInTheDocument();
    expect(screen.getByLabelText("Open Games.txt")).toBeInTheDocument();
    expect(screen.getByLabelText("Open Videos.txt")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is uploaded/)).toBeInTheDocument();
  });

  it("starts an empty catalog that exports both files", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("button", { name: "Start a new catalog" }));
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("No games yet. Add one, or export the empty file.")).toBeInTheDocument();
    expect(await exported(user, "Games.txt")).toBe("﻿game_id,title\r\n");
    expect(await exported(user, "Videos.txt")).toBe("﻿video_id,title,published_at,game_ids\r\n");
  });

  it("says which file is still to open", async () => {
    const user = renderEditor();
    await user.upload(screen.getByLabelText("Open Games.txt"), file(games("zelda,Zelda"), "Games.txt"));
    expect(await screen.findByText("Games.txt is open. Open Videos.txt to continue.")).toBeInTheDocument();
    expect(screen.getByText("Games.txt · 1 game")).toBeInTheDocument();
  });

  it("reports a file that isn't a catalog file, and keeps the page usable", async () => {
    const user = renderEditor();
    await user.upload(screen.getByLabelText("Open Games.txt"), file("title\nZelda\n", "Games.txt"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Games.txt is missing column(s): game_id.");
    expect(screen.getByLabelText("Open Games.txt")).toBeInTheDocument();
  });
});

describe("StudioApp: opening both files", () => {
  it("lists the games, and the videos newest first with their games", async () => {
    const user = renderEditor();
    await openBoth(
      user,
      games("zelda,Zelda", "apex,Apex", "empty,Empty Game"),
      videos(`${ID_A},Old,2020-01-01,zelda`, `${ID_B},New,2024-01-01,zelda;apex`),
    );
    expect(statusText()).toBe("Games.txt · 3 games · Videos.txt · 2 videos");
    expect(listedTitles()).toEqual(["Apex", "Empty Game", "Zelda"]);
    expect(screen.getByRole("tab", { name: /Games/ })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    expect(listedTitles()).toEqual(["New", "Old"]);
    expect(screen.getByText("Zelda, Apex")).toBeInTheDocument();
  });

  it("lists the rows it left out, and says the export leaves them out", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},A,,zelda`, "bad,B,,zelda"));
    expect(screen.getByText("1 row left out when the files were opened")).toBeInTheDocument();
    expect(screen.getByText("Videos.txt row 2: video_id isn't an 11-character YouTube id", { selector: "li" })).toBeInTheDocument();
  });

  it("links videos to games that are opened later", async () => {
    const user = renderEditor();
    await user.upload(screen.getByLabelText("Open Videos.txt"), file(videos(`${ID_A},A,,zelda`), "Videos.txt"));
    await user.upload(screen.getByLabelText("Open Games.txt"), file(games("zelda,Zelda"), "Games.txt"));
    await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    expect(screen.getByText("Zelda")).toBeInTheDocument();
  });

  it("asks before opening another file over unsaved changes", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},A,,zelda`));
    await user.click(screen.getByRole("button", { name: "Edit Zelda" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Zelda II");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(statusText()).toContain("unsaved changes");

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.upload(screen.getByLabelText("Open Games.txt"), file(games("apex,Apex"), "Games.txt"));
    expect(window.confirm).toHaveBeenCalledWith("Discard the changes you haven't exported?");
    expect(listedTitles()).toEqual(["Zelda II"]);
  });
});

describe("StudioApp: games", () => {
  it("adds a game with an id made from its title", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos());
    await user.click(screen.getByRole("button", { name: "Add game" }));
    await user.type(screen.getByLabelText("Title"), "Pokémon Scarlet & Violet");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(listedTitles()).toEqual(["Pokémon Scarlet & Violet", "Zelda"]);
    expect(screen.getByText("pokemon-scarlet-violet")).toBeInTheDocument();
  });

  it("keeps the id when a game is renamed, so its videos keep it", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},A,,zelda`));
    await user.click(screen.getByRole("button", { name: "Edit Zelda" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "The Legend of Zelda");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await exported(user, "Games.txt")).toBe("﻿game_id,title\r\nzelda,The Legend of Zelda\r\n");
    expect(await exported(user, "Videos.txt")).toContain(`${ID_A},A,,zelda`);
  });

  it("refuses a title that another game already has, ignoring case", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos());
    await user.click(screen.getByRole("button", { name: "Add game" }));
    await user.type(screen.getByLabelText("Title"), "zelda");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("There is already a game called “zelda”.")).toBeInTheDocument();
  });

  it("deletes a game, taking it off its videos; a video with no other game goes too", async () => {
    const user = renderEditor();
    await openBoth(
      user,
      games("zelda,Zelda", "apex,Apex"),
      videos(`${ID_A},Solo,,zelda`, `${ID_B},Both,,zelda;apex`),
    );
    await user.click(screen.getByRole("button", { name: "Delete Zelda" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("2 videos are on it. 1 video with no other game is deleted too."));
    expect(listedTitles()).toEqual(["Apex"]);
    expect(await exported(user, "Videos.txt")).toBe(`﻿video_id,title,published_at,game_ids\r\n${ID_B},Both,,apex\r\n`);
  });

  it("filters the games by title or id", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda", "apex,Apex"), videos());
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "APE");
    expect(listedTitles()).toEqual(["Apex"]);
  });
});

describe("StudioApp: videos", () => {
  it("adds a video on the games picked, and refuses one with no game", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda", "apex,Apex"), videos());
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    await user.click(screen.getByRole("button", { name: "Add video" }));

    await user.type(screen.getByLabelText("Video ID or YouTube URL"), ID_A);
    await user.type(screen.getByLabelText("Published"), "2024-05-09");
    await user.type(screen.getByLabelText("Title"), "Trailer");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Choose at least one game.")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Zelda" }));
    await user.click(screen.getByRole("checkbox", { name: "Apex" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(listedTitles()).toEqual(["Trailer"]);
    expect(screen.getByText("Zelda, Apex")).toBeInTheDocument();
    expect(statusText()).toContain("Videos.txt · 1 video");
  });

  it("accepts a YouTube URL as the id, and saves the date in UTC", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos());
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    await user.click(screen.getByRole("button", { name: "Add video" }));
    await user.type(screen.getByLabelText("Video ID or YouTube URL"), `https://youtu.be/${ID_A}`);
    await user.type(screen.getByLabelText("Published"), "2024-05-09T10:30:30+02:00");
    await user.type(screen.getByLabelText("Title"), "Trailer, the one");
    await user.click(screen.getByRole("checkbox", { name: "Zelda" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await exported(user, "Videos.txt")).toBe(`﻿${VIDEOS_HEADER}\r\n${ID_A},Trailer; the one,2024-05-09T08:30:30Z,zelda\r\n`);
  });

  it("refuses an id the catalog already has", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},A,,zelda`));
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    await user.click(screen.getByRole("button", { name: "Add video" }));
    await user.type(screen.getByLabelText("Video ID or YouTube URL"), ID_A);
    await user.type(screen.getByLabelText("Published"), "2024-05-09");
    await user.type(screen.getByLabelText("Title"), "Again");
    await user.click(screen.getByRole("checkbox", { name: "Zelda" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("That video is already in the list.")).toBeInTheDocument();
  });

  it("edits a video's games and exports both files with the change", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda", "apex,Apex"), videos(`${ID_A},Trailer,2024-05-09,zelda`));
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    await user.click(screen.getByRole("button", { name: "Edit Trailer" }));
    const picker = screen.getByRole("group", { name: "Games" });
    await user.click(within(picker).getByRole("checkbox", { name: "Apex" }));
    await user.click(within(picker).getByRole("checkbox", { name: "Zelda" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(statusText()).toContain("unsaved changes");
    expect(await exported(user, "Videos.txt")).toBe(`﻿${VIDEOS_HEADER}\r\n${ID_A},Trailer,2024-05-09T00:00:00Z,apex\r\n`);
    expect(statusText()).not.toContain("unsaved changes");
  });

  it("deletes a video once the user confirms", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},Trailer,,zelda`));
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Delete Trailer" }));
    expect(listedTitles()).toEqual(["Trailer"]);
    await user.click(screen.getByRole("button", { name: "Delete Trailer" }));
    expect(listedTitles()).toEqual([]);
    expect(screen.getByText("No videos yet. Add one, or export the empty file.")).toBeInTheDocument();
  });
});

describe("StudioApp: pictures", () => {
  it("shows a game's cover, then its newest video's thumbnail, from the site's folder", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda", "apex,Apex"), videos(`${ID_A},Old,2020-01-01,zelda`, `${ID_B},New,2024-01-01,zelda`));
    const zelda = screen.getByText("Zelda").closest("li")!;
    const image = zelda.querySelector("img")!;
    expect(image).toHaveAttribute("src", "../assets/thumbnails/games/zelda.webp");
    // Once the cover fails, the card tries the newest video's thumbnail.
    fireEvent.error(image);
    expect(zelda.querySelector("img")).toHaveAttribute("src", `../assets/thumbnails/${ID_B}.webp`);
    // A game with no videos has only its cover to try.
    const apex = screen.getByText("Apex").closest("li")!;
    expect(apex.querySelector("img")).toHaveAttribute("src", "../assets/thumbnails/games/apex.webp");
  });

  it("shows a video's own thumbnail, then YouTube's", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},Old,2020-01-01,zelda`));
    await user.click(screen.getByRole("tab", { name: /Videos/ }));
    const card = screen.getByText("Old").closest("li")!;
    expect(card.querySelector("img")).toHaveAttribute("src", `../assets/thumbnails/${ID_A}.webp`);
  });

  it("gives the form the whole row while a card is being edited", async () => {
    const user = renderEditor();
    await openBoth(user, games("zelda,Zelda", "apex,Apex"), videos());
    await user.click(screen.getByRole("button", { name: "Edit Zelda" }));
    const form = screen.getByDisplayValue("Zelda").closest("li")!;
    expect(form).toHaveClass("studio-edit");
    expect(form.querySelector("img")).toBeNull();
  });
});

/** A saved copy kept in memory, standing in for the browser's. */
function memoryDrafts(initial: Draft | null = null, { saves = true } = {}) {
  let saved: Draft | null = initial;
  const store: DraftStore = {
    available: true,
    load: async () => saved,
    save: vi.fn(async (draft: Draft) => {
      if (saves) saved = draft;
      return saves;
    }),
    clear: vi.fn(async () => {
      saved = null;
      return true;
    }),
  };
  return { store, peek: () => saved };
}

describe("StudioApp: the saved copy in this browser", () => {
  it("keeps the files, with the unsaved changes, and restores them on the next visit", async () => {
    const drafts = memoryDrafts();
    const user = userEvent.setup();
    const first = render(<StudioApp drafts={drafts.store} />);
    await openBoth(user, games("zelda,Zelda"), videos(`${ID_A},Old,2020-01-01,zelda`));
    await user.click(screen.getByRole("button", { name: "Add game" }));
    await user.type(screen.getByLabelText("Title"), "Apex");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(drafts.peek()?.gamesDirty).toBe(true));
    expect(drafts.peek()?.games).toContain("apex");
    expect(screen.getByText(/kept in this browser, but only temporarily/)).toBeInTheDocument();
    first.unmount();

    render(<StudioApp drafts={drafts.store} />);
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
    expect(listedTitles()).toEqual(["Apex", "Zelda"]);
    expect(screen.getByText("Restored your last edits from this browser.")).toBeInTheDocument();
    expect(statusText()).toContain("unsaved changes");
  });

  it("restores a single file, so the other can still be opened", async () => {
    const drafts = memoryDrafts({ games: `${GAMES_HEADER}\nzelda,Zelda\n`, videos: null, gamesDirty: false, videosDirty: false });
    render(<StudioApp drafts={drafts.store} />);
    expect(await screen.findByText("Games.txt is open. Open Videos.txt to continue.")).toBeInTheDocument();
    expect(screen.getByText("Games.txt · 1 game")).toBeInTheDocument();
  });

  it("leaves out a copy it can't read, and says so", async () => {
    const drafts = memoryDrafts({ games: "title\nZelda\n", videos: null, gamesDirty: true, videosDirty: false });
    render(<StudioApp drafts={drafts.store} />);
    expect(await screen.findByText("The saved copy in this browser couldn't be read, so it wasn't loaded.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit the catalog" })).toBeInTheDocument();
  });

  it("forgets the copy on request, and goes back to the start", async () => {
    const drafts = memoryDrafts();
    const user = userEvent.setup();
    render(<StudioApp drafts={drafts.store} />);
    await openBoth(user, games("zelda,Zelda"), videos());
    await user.click(screen.getByRole("button", { name: "Forget saved copy" }));
    expect(drafts.store.clear).toHaveBeenCalledOnce();
    expect(drafts.peek()).toBeNull();
    expect(await screen.findByRole("heading", { name: "Edit the catalog" })).toBeInTheDocument();
  });

  it("says when the browser won't keep a copy", async () => {
    const drafts = memoryDrafts(null, { saves: false });
    const user = userEvent.setup();
    render(<StudioApp drafts={drafts.store} />);
    await openBoth(user, games("zelda,Zelda"), videos());
    expect(await screen.findByText(/won't keep a copy of the catalog/)).toBeInTheDocument();
    expect(screen.queryByText(/kept in this browser, but only temporarily/)).not.toBeInTheDocument();
  });
});

describe("StudioApp: the name", () => {
  it("titles the editor with the site's name, from the page's application-name", () => {
    const meta = document.createElement("meta");
    meta.name = "application-name";
    meta.content = "Test Site";
    document.head.append(meta);
    try {
      renderEditor();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Site Catalog editor");
    } finally {
      meta.remove();
    }
  });
});

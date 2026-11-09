import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioApp } from "./StudioApp.tsx";

const HEADER = "video_id,title,published_at,game_title";
const ID_A = "o9KQ4rlymEQ";
const ID_B = "2VawSnaxtSI";
const ID_C = "GWlKEM3m2EE";

const csv = (...rows: string[]) => `${HEADER}\n${rows.join("\n")}\n`;
const file = (text: string, name = "videos.csv") => new File([text], name, { type: "text/csv" });

const createObjectURL = vi.fn((_blob: Blob) => "blob:studio-test");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  // jsdom can't follow a download link; the test reads the file's blob instead.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

function renderEditor() {
  const user = userEvent.setup();
  render(<StudioApp />);
  return user;
}

/** Opens a file and waits until the editor has taken it over from the start page. */
async function openCsv(user: ReturnType<typeof userEvent.setup>, text: string, name = "videos.csv") {
  await user.upload(screen.getByLabelText("Open a CSV file"), file(text, name));
  await waitFor(() => expect(screen.queryByLabelText("Open a CSV file")).not.toBeInTheDocument());
}

/** The titles in the list, top to bottom. */
const listedTitles = () => [...document.querySelectorAll(".record-title")].map((el) => el.textContent);
const statusText = () => screen.getByRole("status").textContent;

/** The text of the last file the page exported. Read as bytes, keeping the
 * byte order mark: Blob.text() would drop it, as a browser's decoder does. */
async function exportedText(user: ReturnType<typeof userEvent.setup>): Promise<string> {
  await user.click(screen.getByRole("button", { name: /^Export videos\.csv/ }));
  const blob = createObjectURL.mock.calls.at(-1)![0];
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await blob.arrayBuffer());
}

describe("StudioApp: start", () => {
  it("offers a file to open or a new, empty catalog", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "Edit a catalog" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is uploaded/)).toBeInTheDocument();
  });

  it("starts an empty catalog that can be exported", async () => {
    const user = renderEditor();
    await user.click(screen.getByRole("button", { name: "Start a new catalog" }));
    expect(screen.getByText("No videos yet. Add one, or export the empty catalog.")).toBeInTheDocument();
    expect(await exportedText(user)).toBe("﻿video_id,title,published_at,game_title\r\n");
  });
});

describe("StudioApp: opening a file", () => {
  it("lists the videos newest first, with the game and file summary", async () => {
    const user = renderEditor();
    await openCsv(user, csv(
      `${ID_A},Older,2018-12-09,Game One`,
      `${ID_B},Newer,2024-06-09,Game Two`,
      `${ID_C},Newest,2024-07-01,Game One`,
    ));
    expect(listedTitles()).toEqual(["Newest", "Newer", "Older"]);
    expect(statusText()).toBe("videos.csv · 3 videos in 2 games");
  });

  it("reports a file that isn't a catalog, and keeps the page usable", async () => {
    const user = renderEditor();
    await user.upload(screen.getByLabelText("Open a CSV file"), file("name,url\nx,y\n", "playlist.csv"));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "playlist.csv is missing column(s): video_id, title, published_at, game_title.",
    );
    expect(screen.getByRole("button", { name: "Start a new catalog" })).toBeInTheDocument();
  });

  it("lists the rows it skipped, and says the export leaves them out", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Good,2024-06-09,Game One`, `${ID_B},Bad date,2024-02-30,Game One`));
    expect(screen.getByText("1 row skipped when the file was opened")).toBeInTheDocument();
    expect(screen.getByText(/Row 2: '2024-02-30' isn't a valid date/)).toBeInTheDocument();
    expect(listedTitles()).toEqual(["Good"]);
  });
});

describe("StudioApp: editing", () => {
  it("edits a video, marks the catalog unsaved, and exports the change", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Old title,2024-06-09,Game One`));

    await user.click(screen.getByRole("button", { name: "Edit Old title" }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "New title, with a comma");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(listedTitles()).toEqual(["New title, with a comma"]);
    expect(statusText()).toContain("unsaved changes");

    const text = await exportedText(user);
    expect(text).toBe(`﻿${HEADER}\r\n${ID_A},New title; with a comma,2024-06-09T00:00:00Z,Game One\r\n`);
    expect(statusText()).not.toContain("unsaved changes");
  });

  it("shows field errors and keeps the form open until the row is valid", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Title,2024-06-09,Game One`));

    await user.click(screen.getByRole("button", { name: "Edit Title" }));
    const date = screen.getByLabelText("Published");
    await user.clear(date);
    await user.type(date, "2024-02-30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText(/isn't a valid date/)).toBeInTheDocument();
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("adds a video, with the game chosen from the ones already there", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Existing,2024-06-09,Kingdom Hearts III`));

    await user.click(screen.getByRole("button", { name: "Add video" }));
    await user.type(screen.getByLabelText("Video ID or YouTube URL"), `https://youtu.be/${ID_B}`);
    await user.type(screen.getByLabelText("Published"), "2024-07-01T12:00:00+02:00");
    await user.type(screen.getByLabelText("Title"), "Added");
    await user.type(screen.getByLabelText("Game"), "kingdom hearts iii");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(listedTitles()).toEqual(["Added", "Existing"]);
    const text = await exportedText(user);
    expect(text).toContain(`${ID_B},Added,2024-07-01T10:00:00Z,Kingdom Hearts III`);
  });

  it("refuses an id the catalog already has", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Existing,2024-06-09,Game One`));

    await user.click(screen.getByRole("button", { name: "Add video" }));
    await user.type(screen.getByLabelText("Video ID or YouTube URL"), ID_A);
    await user.type(screen.getByLabelText("Published"), "2024-07-01");
    await user.type(screen.getByLabelText("Title"), "Copy");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("That video is already in the catalog.")).toBeInTheDocument();
    expect(listedTitles()).toEqual(["Existing"]);
  });

  it("deletes a video once the user confirms", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Keep,2024-06-09,Game One`, `${ID_B},Drop,2024-06-08,Game One`));

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Delete Drop" }));
    expect(listedTitles()).toEqual(["Keep", "Drop"]);

    await user.click(screen.getByRole("button", { name: "Delete Drop" }));
    expect(listedTitles()).toEqual(["Keep"]);
    expect(await exportedText(user)).not.toContain(ID_B);
  });

  it("filters the list by title, game or id, ignoring case and accents", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},Première,2024-06-09,Pokémon`, `${ID_B},Other,2024-06-08,Game One`));

    await user.type(screen.getByRole("searchbox"), "pokemon");
    expect(listedTitles()).toEqual(["Première"]);

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No videos match the search.")).toBeInTheDocument();
  });
});

describe("StudioApp: replacing the catalog", () => {
  it("asks before opening another file over unsaved changes", async () => {
    const user = renderEditor();
    await openCsv(user, csv(`${ID_A},First,2024-06-09,Game One`, `${ID_B},Gone,2024-06-08,Game One`));
    await user.click(screen.getByRole("button", { name: "Delete Gone" }));
    expect(statusText()).toContain("unsaved changes");

    const next = csv(`${ID_C},Second,2024-06-07,Game One`);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.upload(screen.getByLabelText("Open another file"), file(next));
    expect(listedTitles()).toEqual(["First"]);

    await user.upload(screen.getByLabelText("Open another file"), file(next));
    await waitFor(() => expect(listedTitles()).toEqual(["Second"]));
    expect(statusText()).not.toContain("unsaved changes");
  });
});

describe("StudioApp: paging", () => {
  it("draws 50 videos a page, and moves between pages", async () => {
    const user = renderEditor();
    const rows = Array.from({ length: 60 }, (_, i) => {
      const id = `ID${String(i).padStart(9, "0")}`;
      return `${id},Video ${String(i).padStart(2, "0")},2024-01-${String((i % 28) + 1).padStart(2, "0")},Game`;
    });
    await openCsv(user, csv(...rows));

    expect(document.querySelectorAll(".record").length).toBe(50);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(document.querySelectorAll(".record").length).toBe(10);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.type(screen.getByRole("searchbox"), "Video 5");
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".record").length).toBe(10);
  });
});

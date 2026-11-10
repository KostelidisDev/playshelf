import { describe, expect, it } from "vitest";
import { crc32, zipText } from "./zip.ts";

// Keeps the byte order mark, which the text is written with.
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

/** Reads the archive back the way a zip reader does: the end record, then the
 * central directory, then each entry's local header and data. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const size = view.getUint32(at + 20, true);
    const crc = view.getUint32(at + 16, true);
    const nameLength = view.getUint16(at + 28, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(localAt, true)).toBe(0x04034b50);
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const data = bytes.subarray(dataAt, dataAt + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return files;
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("zipText", () => {
  it("stores each text file, with its name, so the archive reads back", () => {
    const text = "﻿game_id,title\r\nzelda,Zelda — Ōkami\r\n";
    const archive = zipText([
      { name: "Games.txt", text },
      { name: "Videos.txt", text: "video_id,title\r\n" },
    ], new Date(2026, 9, 31, 12, 0, 0));
    const files = unzip(archive);
    expect([...files.keys()]).toEqual(["Games.txt", "Videos.txt"]);
    expect(files.get("Games.txt")).toBe(text);
    expect(files.get("Videos.txt")).toBe("video_id,title\r\n");
  });

  it("writes an empty archive with no entries", () => {
    expect(unzip(zipText([])).size).toBe(0);
  });
});

/* Saves text to the user's computer as a file, through a temporary link: the
 * only way a page can offer a download without a server. */

/** Downloads `text` as a file called `name`, as UTF-8 plain text. */
export function saveTextFile(name: string, text: string): void {
  saveFile(name, new Blob([text], { type: "text/plain;charset=utf-8" }));
}

/** Downloads `bytes` (of the given media type) as a file called `name`. */
export function saveBytesFile(name: string, bytes: Uint8Array, type: string): void {
  saveFile(name, new Blob([bytes as BlobPart], { type }));
}

function saveFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a moment later, so the download has started first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

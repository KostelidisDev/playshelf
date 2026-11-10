/* Saves text to the user's computer as a file, through a temporary link: the
 * only way a page can offer a download without a server. */

/** Downloads `text` as a file called `name`, as UTF-8 plain text. */
export function saveTextFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a moment later, so the download has started first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

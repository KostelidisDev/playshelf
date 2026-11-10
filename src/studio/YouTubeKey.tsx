/* The optional YouTube key panel on the videos tab. With a key saved, entering
 * a video's id or URL also fills in its publish date; without one, only the
 * title is looked up. The key stays in this browser (youtubeKey.ts). */

import { useState } from "react";

interface Props {
  /** The key saved in this browser, or null when there's none. */
  savedKey: string | null;
  onSave: (key: string | null) => void;
}

export function YouTubeKeyPanel({ savedKey, onSave }: Props) {
  const [text, setText] = useState(savedKey ?? "");

  return (
    <details className="studio-key">
      <summary>{savedKey ? "YouTube key saved" : "Fill publish dates from YouTube"}</summary>
      <form
        className="studio-key-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(text.trim() || null);
        }}
      >
        <label className="field-label" htmlFor="youtube-key">YouTube Data API key (optional)</label>
        <div className="studio-key-row">
          <input
            id="youtube-key"
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn btn-small" type="submit">Save key</button>
        </div>
        <p className="field-hint">
          With a key, entering a video's ID or URL also fills in its publish date. The key is kept in this browser only.
          Restrict it to the YouTube Data API v3 in Google Cloud. Leave it empty to remove it.
        </p>
      </form>
    </details>
  );
}

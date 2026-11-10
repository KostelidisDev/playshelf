/* The form for adding a game or renaming one. Its id is made when the game
 * is first saved and never changes, so the form only shows it. */

import { useState, type FormEvent } from "react";
import { TextField } from "./TextField.tsx";

interface Props {
  /** The title to start with; empty for a new game. */
  initialTitle: string;
  /** The id of a game being edited, shown as it stays fixed. */
  id: string | null;
  /** Returns the error to show, or null once the game is saved. */
  onSave: (title: string) => string | null;
  onCancel: () => void;
}

export function GameForm({ initialTitle, id, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(onSave(title));
  }

  return (
    <form className="record-form" onSubmit={submit} noValidate>
      <div className="record-form-grid">
        <TextField id="game-title" label="Title" wide autoFocus value={title} onChange={setTitle} error={error ?? undefined} />
        {id !== null && (
          <p className="field-hint field-wide">
            ID: <code>{id}</code>. It stays the same when the game is renamed, so its videos keep it.
          </p>
        )}
      </div>
      <div className="studio-actions">
        <button className="btn" type="submit">Save</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

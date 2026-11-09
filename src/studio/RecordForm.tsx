/* The form for adding a video or editing one. It holds the typed values
 * until Save, which the parent checks: errors come back per field. */

import { useState, type ChangeEvent, type FormEvent } from "react";
import type { Draft, FieldErrors } from "../lib/studio.ts";

interface Props {
  initial: Draft;
  /** The game titles already in the catalog, offered while typing. */
  suggestions: readonly string[];
  /** Returns the field errors to show, or null once the row is saved. */
  onSave: (draft: Draft) => FieldErrors | null;
  onCancel: () => void;
}

export function RecordForm({ initial, suggestions, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const change = (field: keyof Draft) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(onSave(draft) ?? {});
  }

  return (
    <form className="record-form" onSubmit={submit} noValidate>
      <div className="record-form-grid">
        <TextField
          id="record-id"
          label="Video ID or YouTube URL"
          value={draft.id}
          onChange={change("id")}
          error={errors.id}
        />
        <TextField
          id="record-published"
          label="Published"
          placeholder="2024-05-09T10:30:30Z"
          hint="A date, or a date and time. Without a time zone, UTC is used."
          value={draft.publishedAt}
          onChange={change("publishedAt")}
          error={errors.publishedAt}
        />
        <TextField
          id="record-title"
          label="Title"
          wide
          hint="Commas and double quotes are saved as ; and ', as in the studio's export."
          value={draft.title}
          onChange={change("title")}
          error={errors.title}
        />
        <TextField
          id="record-game"
          label="Game"
          list="studio-games"
          hint="Leave empty for a video that isn't under a game."
          value={draft.gameTitle}
          onChange={change("gameTitle")}
          error={errors.gameTitle}
        />
      </div>
      <datalist id="studio-games">
        {suggestions.map((title) => <option key={title} value={title} />)}
      </datalist>
      <div className="studio-actions">
        <button className="btn" type="submit">Save</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string | undefined;
  list?: string | undefined;
  wide?: boolean | undefined;
}

function TextField({ id, label, value, onChange, error, hint, placeholder, list, wide }: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={wide ? "field field-wide" : "field"}>
      <label htmlFor={id} className="field-label">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        list={list}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && <p id={hintId} className="field-hint">{hint}</p>}
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}

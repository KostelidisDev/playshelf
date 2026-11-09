/* The form for adding a video or editing one. The games are picked from the
 * games list, with a filter for long lists. Save hands the draft to the
 * parent, which checks it and sends back the field errors. */

import { useState, type FormEvent } from "react";
import type { GameRecord } from "../lib/catalog.ts";
import type { FieldErrors, VideoDraft, VideoField } from "../lib/studio.ts";
import { normalizeText } from "../lib/text.ts";
import { TextField } from "./TextField.tsx";

interface Props {
  initial: VideoDraft;
  games: readonly GameRecord[];
  /** Returns the field errors to show, or null once the video is saved. */
  onSave: (draft: VideoDraft) => FieldErrors<VideoField> | null;
  onCancel: () => void;
}

export function VideoForm({ initial, games, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<VideoField>>({});
  const [gameFilter, setGameFilter] = useState("");

  const set = <K extends "id" | "title" | "publishedAt">(field: K) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleGame = (id: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      gameIds: checked ? [...current.gameIds, id] : current.gameIds.filter((gameId) => gameId !== id),
    }));
  };

  const needle = normalizeText(gameFilter.trim());
  const shownGames = needle ? games.filter((game) => normalizeText(game.title).includes(needle)) : games;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(onSave(draft) ?? {});
  }

  return (
    <form className="record-form" onSubmit={submit} noValidate>
      <div className="record-form-grid">
        <TextField id="video-id" label="Video ID or YouTube URL" value={draft.id} onChange={set("id")} error={errors.id} />
        <TextField
          id="video-published"
          label="Published"
          placeholder="2024-05-09T10:30:30Z"
          hint="A date, or a date and time. Without a time zone, UTC is used."
          value={draft.publishedAt}
          onChange={set("publishedAt")}
          error={errors.publishedAt}
        />
        <TextField
          id="video-title"
          label="Title"
          wide
          hint="Commas and double quotes are saved as ; and ', as in the studio's export."
          value={draft.title}
          onChange={set("title")}
          error={errors.title}
        />
      </div>

      <fieldset className={errors.gameIds ? "game-picker game-picker-invalid" : "game-picker"} aria-describedby={errors.gameIds ? "video-games-error" : undefined}>
        <legend className="field-label">Games</legend>
        {games.length === 0 ? (
          <p className="field-hint">There are no games yet. Add one under Games first.</p>
        ) : (
          <>
            {games.length > 8 && (
              <input
                type="search"
                className="game-picker-filter"
                aria-label="Filter games"
                placeholder="Filter games"
                value={gameFilter}
                onChange={(event) => setGameFilter(event.target.value)}
                autoComplete="off"
              />
            )}
            <div className="game-picker-list">
              {shownGames.map((game) => (
                <label key={game.id} className="game-picker-item">
                  <input
                    type="checkbox"
                    checked={draft.gameIds.includes(game.id)}
                    onChange={(event) => toggleGame(game.id, event.target.checked)}
                  />
                  <span>{game.title}</span>
                </label>
              ))}
              {shownGames.length === 0 && <p className="field-hint">No game matches “{gameFilter.trim()}”.</p>}
            </div>
          </>
        )}
        {errors.gameIds && <p id="video-games-error" className="field-error">{errors.gameIds}</p>}
      </fieldset>

      <div className="studio-actions">
        <button className="btn" type="submit">Save</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

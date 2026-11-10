/* The published date and time: a button that opens a calendar, with hour and
 * minute menus under it. Days and times are picked, never typed, so the value
 * is always a real moment. The file keeps times in UTC, so the picker shows
 * UTC too. Escape, a click outside or Done closes the calendar, and Escape
 * and Done send focus back to the button. */

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { publishedParts, setPublished } from "../lib/studio.ts";

interface Props {
  id: string;
  /** The published value as the draft holds it, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// YouTube starts in 2005, so the year menu covers everything from then on.
const FIRST_YEAR = 2005;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);

function toDate(day: string): Date | undefined {
  const match = DAY.exec(day);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const SHOWN = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function DatePicker({ id, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const parts = publishedParts(value);
  const selected = parts ? toDate(parts.day) : undefined;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="date-field" ref={wrapRef}>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        className="date-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {parts ? `${SHOWN.format(parts.instant)} UTC` : <span className="date-placeholder">Pick a date and time</span>}
      </button>

      {open && (
        <div className="date-popover" role="dialog" aria-label="Choose the published date and time">
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected ?? new Date()}
            captionLayout="dropdown"
            startMonth={new Date(FIRST_YEAR, 0)}
            endMonth={new Date(new Date().getFullYear() + 1, 11)}
            onSelect={(day) => {
              if (day) onChange(setPublished(value, { day: toDay(day) }));
            }}
          />
          <div className="date-time" role="group" aria-label="Time (UTC)">
            <select
              aria-label="Hour"
              value={parts ? String(parts.hour) : ""}
              disabled={!parts}
              onChange={(event) => onChange(setPublished(value, { hour: Number(event.target.value) }))}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>
              ))}
            </select>
            <span aria-hidden="true">:</span>
            <select
              aria-label="Minute"
              value={parts ? String(parts.minute) : ""}
              disabled={!parts}
              onChange={(event) => onChange(setPublished(value, { minute: Number(event.target.value) }))}
            >
              {MINUTES.map((minute) => (
                <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>
              ))}
            </select>
            <span className="field-hint">UTC</span>
          </div>
          <div className="date-popover-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!parts}
              onClick={() => {
                onChange("");
                close();
              }}
            >
              Clear
            </button>
            <button type="button" className="btn" onClick={close}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

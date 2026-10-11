import { useRef } from "react";
import { useDocumentKeydown } from "../hooks/useDocumentKeydown.ts";
import { MAX_QUERY_LENGTH } from "../lib/routes.ts";
import { SearchIcon } from "./Icons.tsx";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** The game search. Enter closes the on-screen keyboard, Escape clears the
 * field, and "/" anywhere on the page focuses it. */
export function SearchBox({ value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);

  useDocumentKeydown((event) => {
    if (event.key === "/" && document.activeElement !== input.current) {
      event.preventDefault();
      input.current?.focus();
    }
  });

  return (
    <label className="search">
      <SearchIcon />
      <span className="visually-hidden">Search games</span>
      <input
        ref={input}
        type="search"
        placeholder="Search games"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        maxLength={MAX_QUERY_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
      />
    </label>
  );
}

/** Lowercase text without accents, for search: "pokemon" finds "Pokémon"
 * and "αμνησια" finds "Αμνησία". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The title's letter in the A-Z index: its first character, uppercased
 * and without accents. Anything other than A-Z (digits, symbols, other
 * scripts) goes under "#". */
export function firstLetter(title: string): string | null {
  if (!title) return null;
  const char = normalizeText(title.trim().charAt(0)).toUpperCase();
  return /^[A-Z]$/.test(char) ? char : "#";
}

/** One line of text, with control and bidi-override characters replaced by
 * spaces and the length capped. React already renders data as text; this
 * also stops invisible characters from disguising how a title reads. */
export function cleanText(value: unknown, maxLength = 300): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩؜]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** "1 game", "2 games". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

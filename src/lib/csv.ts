/** One CSV row, keyed by the header row. */
export type CsvRecord = Record<string, string>;

/** A small RFC 4180 parser: handles quoted fields with commas, escaped
 * quotes ("") and line breaks inside them, CRLF line ends and a leading
 * BOM, and skips blank lines. Returns one record per row, keyed by the
 * header row. */
export function parseCSV(text: string): CsvRecord[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header = [], ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  // Null-prototype records: a column named "__proto__" is just a column and
  // can't reach Object.prototype.
  return body.map((cells) => {
    const record: CsvRecord = Object.create(null);
    header.forEach((key, i) => { record[key] = cells[i] ?? ""; });
    return record;
  });
}

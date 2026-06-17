/** CSV helpers shared by data export (Reports, Children) and import (Children). */

/** Serialize an array of row objects to CSV (headers = union of keys). */
export function objectsToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headerSet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k);
  const headers = Array.from(headerSet);
  const cell = (v: unknown): string => {
    if (v == null) return "";
    let s: string;
    if (v instanceof Date) s = v.toISOString().slice(0, 10);
    else if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\n");
}

/** Trigger a client-side download of a CSV string. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV text into a grid of string cells. Handles quoted fields, escaped
 * quotes ("") and both \n and \r\n line endings. Fully-empty rows are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0].trim() === ""));
}

/**
 * Parse CSV with a header row into objects keyed by normalized header
 * (lowercased, non-alphanumerics stripped) → e.g. "First Name" -> "firstname".
 */
export function parseCsvToObjects(text: string): Record<string, string>[] {
  const grid = parseCsv(text);
  if (grid.length < 1) return [];
  const headers = grid[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  return grid.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
}

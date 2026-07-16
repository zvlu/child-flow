/**
 * Parse a `YYYY-MM-DD` date-input value as LOCAL midnight.
 *
 * `new Date("2021-09-15")` parses as UTC midnight, which renders as the
 * previous day in any timezone behind UTC (e.g. a DOB entered as Sep 15 shows
 * as Sep 14). Building the date from local Y/M/D components avoids that.
 * Returns undefined for empty/invalid input.
 */
export function dateInputToLocal(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Shared display formatters — previously duplicated (byte-for-byte, in some
 * cases) across Staff.tsx, Billing.tsx, ChildDetail.tsx, Children.tsx,
 * Health.tsx, useActionItems.ts, Compliance.tsx, and Reports.tsx. Consolidated
 * here so every page renders dates/ages the same way and a future format
 * change only happens in one place.
 */

/** Terse locale date, e.g. "7/15/2026". Returns "—" for empty/invalid input. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/** Long-form date, e.g. "Jul 15, 2026". Returns "—" for empty/invalid input. */
export function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Long-form date `n` days before today, e.g. daysAgo(3) → "Jul 12, 2026". */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateLong(d);
}

/** Age from a date of birth, formatted as "Xy Ym". Returns "—" if `dob` is missing/invalid. */
export function formatAge(dob: string | Date | null | undefined): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) months = 0;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

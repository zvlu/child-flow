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

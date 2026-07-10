/**
 * Guard for all-optional update payloads. Drizzle throws "No values to set"
 * when every field in a patch is undefined — reachable through any API caller
 * that sends an empty update, even though the UI never does. Callers strip
 * undefined keys and skip the UPDATE entirely when nothing remains.
 */
export function definedPatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/** True when a patch has no defined values (an UPDATE would be a no-op or throw). */
export function isEmptyPatch(patch: Record<string, unknown>): boolean {
  return Object.values(patch).every((v) => v === undefined);
}

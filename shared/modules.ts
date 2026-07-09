/**
 * Optional per-organization feature modules.
 *
 * Sprout's core is general school / early-childhood management; modules add
 * program-type-specific feature sets on top. Stored as a JSON string array in
 * `organizations.enabledModules` (null/empty = core only).
 */
export const MODULE_IDS = ["head_start"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  head_start: "Head Start compliance",
};

export const MODULE_DESCRIPTIONS: Record<ModuleId, string> = {
  head_start:
    "PIR reporting, ERSEA eligibility & selection, Family Partnership Agreements, Policy Council, §1302 health deadlines, chronic absence, disability services, grant & budget, CLASS/ECERS, and in-kind tracking.",
};

/** Does this org have a module enabled? Tolerates null/undefined/malformed values. */
export function hasModule(
  org: { enabledModules?: unknown } | null | undefined,
  id: ModuleId,
): boolean {
  const mods = org?.enabledModules;
  return Array.isArray(mods) && mods.includes(id);
}

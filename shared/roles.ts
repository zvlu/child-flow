// Single source of truth for the staff functional-role taxonomy (§1302.91).
//
// The DB enum in drizzle/schema.ts must list the SAME values — it's the
// database contract, and a drift-guard test (server/roleTaxonomy.test.ts)
// asserts the two stay in sync. Everything else (tRPC validators, REST labels,
// the web role pickers, the manager checks) imports from here so there's one
// place to change. The native iOS app hand-mirrors this (Swift can't import TS).

export const STAFF_ROLE_VALUES = [
  "admin", "director", "fiscal_officer",
  "education_coordinator", "coach",
  "health_coordinator", "nurse", "nutritionist", "mental_health_consultant",
  "disabilities_coordinator",
  "family_services_manager", "family_advocate", "home_visitor",
  "ersea_coordinator",
  "teacher", "assistant",
  "cook", "bus_driver",
  "coordinator",
  "assistant_director", "center_director", "data_manager", "lead_teacher",
  "office_manager", "enrollment_specialist", "custodian", "bus_monitor",
  "kitchen_assistant", "substitute",
] as const;

export type StaffRoleValue = (typeof STAFF_ROLE_VALUES)[number];

/** value → human display label, shared by web + REST (and mirrored on iOS). */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  director: "Head Start Director",
  fiscal_officer: "Fiscal Officer",
  education_coordinator: "Education Coordinator",
  coach: "Coach",
  health_coordinator: "Health Coordinator",
  nurse: "Nurse",
  nutritionist: "Nutritionist / RD",
  mental_health_consultant: "Mental Health Consultant",
  disabilities_coordinator: "Disabilities Coordinator",
  family_services_manager: "Family Services Manager",
  family_advocate: "Family Advocate",
  home_visitor: "Home Visitor",
  ersea_coordinator: "ERSEA Coordinator",
  teacher: "Teacher",
  assistant: "Assistant Teacher",
  cook: "Cook / Food Service",
  bus_driver: "Bus Driver",
  coordinator: "Coordinator",
  assistant_director: "Assistant Director",
  center_director: "Center Director",
  data_manager: "Data Manager",
  lead_teacher: "Lead Teacher",
  office_manager: "Office Manager",
  enrollment_specialist: "Enrollment Specialist",
  custodian: "Custodian / Maintenance",
  bus_monitor: "Bus Monitor",
  kitchen_assistant: "Kitchen Assistant",
  substitute: "Substitute / Floater",
};

/**
 * Functional roles that may manage the employees who report to them. The
 * users.role ACCESS tier "admin" always can, org-wide; these titles manage
 * only their direct/indirect reports.
 */
export const STAFF_MANAGER_ROLES: readonly string[] = [
  "director",
  "assistant_director",
  "center_director",
  "education_coordinator",
  "health_coordinator",
  "disabilities_coordinator",
  "ersea_coordinator",
  "family_services_manager",
];

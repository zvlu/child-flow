import { date, decimal, int, json, mediumtext, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /**
   * Profile picture as a self-contained data URL (data:image/...;base64,...).
   * The client resizes/crops to a small square before upload, so this stays
   * well within mediumtext; null means "show initials".
   */
  avatarUrl: mediumtext("avatarUrl"),
  /**
   * scrypt password hash for email/password (native mobile) sign-in.
   * Null for OAuth-only accounts. Never returned to clients.
   * Format: `scrypt$<saltHex>$<hashHex>` (see server/_core/password.ts).
   */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /**
   * Access tier:
   * - admin: program administration (staff management, bulk operations)
   * - staff: day-to-day program work (default for new internal accounts)
   * - parent: family-app account; sees ONLY their own family via familyId
   */
  role: mysqlEnum("role", ["admin", "staff", "parent"]).default("staff").notNull(),
  /**
   * The organization (program) this user belongs to. Staff/admin are scoped to
   * exactly one org; data routes derive/enforce access from this rather than
   * trusting a client-supplied id. Null for the platform owner / unassigned.
   */
  organizationId: int("organizationId"),
  /** For parent accounts: the family this user belongs to. Null for staff/admin. */
  familyId: int("familyId"),
  /**
   * Per-user preferences (notification toggles, 2FA flag). Stored as JSON so the
   * preference set can grow without a migration. Never contains secrets.
   */
  settings: json("settings").$type<UserSettings>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Shape of users.settings — all fields optional so partial updates merge cleanly. */
export type UserSettings = {
  /** Whether the user has opted into two-factor auth (flag only; not a TOTP secret). */
  twoFactorEnabled?: boolean;
  /**
   * Preferred language for messages and app content (BCP-47-ish codes matching
   * the family app: en, es, ht, zh-Hans, vi, ar). Messages from the other side
   * of a conversation are auto-translated into this language on read.
   */
  preferredLanguage?: string;
  /** Notification channel/topic toggles keyed by a stable preference id. */
  notifications?: Record<string, boolean>;
  /**
   * Per-user navigation layout. Each surface stores a desired path `order` and a
   * set of `hidden` paths; absent/empty means "use the app defaults".
   */
  navigation?: {
    topNav?: { order?: string[]; hidden?: string[] };
    sideNav?: { order?: string[]; hidden?: string[] };
  };
};

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audit log of access to sensitive records (child PII, health/PHI).
 * Append-only; rows are never updated or deleted by the application.
 * Supports the HIPAA audit-control safeguard (45 CFR §164.312(b)).
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** User who performed the action. Null only for unauthenticated/system events. */
  userId: int("userId"),
  /** Stable identifier for the actor even if the user row is later removed. */
  actorOpenId: varchar("actorOpenId", { length: 64 }),
  /** e.g. "read", "create", "update", "delete", "login", "login_failed". */
  action: varchar("action", { length: 32 }).notNull(),
  /** e.g. "health_record", "child", "family", "auth". */
  resourceType: varchar("resourceType", { length: 48 }).notNull(),
  /** Identifier of the specific record acted on, when applicable. */
  resourceId: varchar("resourceId", { length: 64 }),
  /** Source IP, best-effort. */
  ipAddress: varchar("ipAddress", { length: 64 }),
  /** Optional human-readable context. */
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Organizations table for multi-tenant support.
 * Each organization represents a school, childcare center, or agency; optional
 * feature modules (e.g. Head Start compliance) are toggled via enabledModules.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  agencyId: varchar("agencyId", { length: 64 }).notNull().unique(),
  description: text("description"),
  /** Editable program profile (Settings › Program). */
  director: varchar("director", { length: 160 }),
  directorEmail: varchar("directorEmail", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: varchar("address", { length: 400 }),
  classroomCount: int("classroomCount"),
  ownerId: int("ownerId").notNull().references(() => users.id),
  subscriptionTier: mysqlEnum("subscriptionTier", ["starter", "professional", "enterprise"]).default("starter").notNull(),
  maxChildren: int("maxChildren").default(100),
  maxStaff: int("maxStaff").default(20),
  isActive: int("isActive").default(1),
  /** Optional feature modules enabled for this org, e.g. ["head_start"]. Null/empty = core only. */
  enabledModules: json("enabledModules").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Children table for storing child records.
 */
export const children = mysqlTable("children", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  dateOfBirth: timestamp("dateOfBirth"),
  gender: mysqlEnum("gender", ["male", "female", "other", "prefer_not_to_say"]),
  enrollmentDate: timestamp("enrollmentDate").defaultNow(),
  status: mysqlEnum("status", ["active", "inactive", "graduated", "withdrawn"]).default("active"),
  familyId: int("familyId").references(() => families.id),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Child = typeof children.$inferSelect;
export type InsertChild = typeof children.$inferInsert;

/**
 * Color-coded safety flags surfaced on a child everywhere they appear, so
 * staff see allergies / dietary / disability / special needs at a glance.
 */
export const childFlags = mysqlTable("child_flags", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  type: mysqlEnum("type", ["allergy", "dietary", "disability", "special", "medication"]).notNull(),
  /** Short label shown on the chip, e.g. "Peanuts", "Vegetarian", "IEP". */
  label: varchar("label", { length: 100 }).notNull(),
  /** Optional detail for the child's profile (not shown on the chip). */
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChildFlag = typeof childFlags.$inferSelect;
export type InsertChildFlag = typeof childFlags.$inferInsert;

/**
 * Staff table for storing staff member information.
 */
export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  userId: int("userId").references(() => users.id),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }),
  /**
   * Program role, grounded in the §1302.91 staffing taxonomy. Original four
   * values kept for data compatibility; "coordinator" remains as the legacy
   * generic. users.role stays the ACCESS tier (admin/staff/parent) — this is
   * the functional role that shapes each staff member's default experience.
   */
  role: mysqlEnum("role", [
    "admin", "director", "fiscal_officer",
    "education_coordinator", "coach",
    "health_coordinator", "nurse", "nutritionist", "mental_health_consultant",
    "disabilities_coordinator",
    "family_services_manager", "family_advocate", "home_visitor",
    "ersea_coordinator",
    "teacher", "assistant",
    "cook", "bus_driver",
    "coordinator",
  ]).default("teacher"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;

/**
 * Admin-defined staff roles (e.g. "Family Advocate", "Health Coordinator").
 * These are organization-scoped *labels* layered on top of the fixed access
 * tiers — `accessLevel` maps a custom role to the underlying users.role tier
 * (staff or admin) so the RBAC surface stays a closed enum while programs can
 * name positions however they like. `color` themes the badge shown in the UI.
 */
export const customRoles = mysqlTable("custom_roles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  accessLevel: mysqlEnum("accessLevel", ["staff", "admin"]).default("staff").notNull(),
  color: varchar("color", { length: 24 }).default("sage").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomRole = typeof customRoles.$inferSelect;
export type InsertCustomRole = typeof customRoles.$inferInsert;

/**
 * Families table for storing family information.
 */
export const families = mysqlTable("families", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  /** Case-load management: the Family Advocate responsible for this family (null = unassigned). */
  familyAdvocateId: int("familyAdvocateId").references(() => staff.id),
  primaryContactName: varchar("primaryContactName", { length: 100 }).notNull(),
  primaryContactPhone: varchar("primaryContactPhone", { length: 20 }),
  primaryContactEmail: varchar("primaryContactEmail", { length: 320 }),
  secondaryContactName: varchar("secondaryContactName", { length: 100 }),
  secondaryContactPhone: varchar("secondaryContactPhone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Family = typeof families.$inferSelect;
export type InsertFamily = typeof families.$inferInsert;

/**
 * Enrollment applications / waitlist. Each row is a prospective child's
 * application; staff triage it (priority + status) and, on approval, "enroll"
 * it — which creates the real family + child records and links back via
 * enrolledChildId so the same application is never enrolled twice.
 */
export const enrollmentApplications = mysqlTable("enrollment_applications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childFirstName: varchar("childFirstName", { length: 100 }).notNull(),
  childLastName: varchar("childLastName", { length: 100 }).notNull(),
  dateOfBirth: timestamp("dateOfBirth"),
  gender: mysqlEnum("gender", ["male", "female", "other", "prefer_not_to_say"]),
  parentName: varchar("parentName", { length: 160 }),
  parentPhone: varchar("parentPhone", { length: 32 }),
  parentEmail: varchar("parentEmail", { length: 320 }),
  address: varchar("address", { length: 400 }),
  incomeLevel: mysqlEnum("incomeLevel", ["below_100", "below_130", "below_185", "above_185"]),
  householdSize: int("householdSize"),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "reviewing", "approved", "denied", "enrolled"]).default("pending").notNull(),
  notes: text("notes"),
  /** children.id once this application has been enrolled; null while not. */
  enrolledChildId: int("enrolledChildId"),
  appliedDate: timestamp("appliedDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EnrollmentApplication = typeof enrollmentApplications.$inferSelect;

/**
 * Document-verification checklist for one application (ERSEA eligibility
 * paperwork). primaryAdult/secondaryAdult/childChecklist are opaque JSON
 * blobs owned entirely by the client (iOS AdultVerification /
 * ChildDocVerification structs) — the server just stores and returns them,
 * so their shape can evolve without a migration.
 *
 * id is a client-generated UUID string (not autoincrement) because the iOS
 * app creates a verification locally before it's ever persisted and reuses
 * that same id on every subsequent save — see ApplicationVerificationView.
 * status values are the exact display strings the iOS enum encodes
 * ("Pending" / "In Progress" / "Complete" / "Needs Info"), so the server
 * doesn't need any translation layer.
 */
export const applicationVerifications = mysqlTable("application_verifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childName: varchar("childName", { length: 200 }).notNull(),
  applicationDate: timestamp("applicationDate").defaultNow().notNull(),
  verifiedBy: varchar("verifiedBy", { length: 160 }).default("").notNull(),
  verifiedDate: timestamp("verifiedDate"),
  primaryAdult: json("primaryAdult").notNull(),
  secondaryAdult: json("secondaryAdult"),
  childChecklist: json("childChecklist").notNull(),
  status: mysqlEnum("status", ["Pending", "In Progress", "Complete", "Needs Info"]).default("Pending").notNull(),
  notes: text("notes").default(""),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApplicationVerificationRow = typeof applicationVerifications.$inferSelect;
export type InsertApplicationVerificationRow = typeof applicationVerifications.$inferInsert;
export type InsertEnrollmentApplication = typeof enrollmentApplications.$inferInsert;

/**
 * In-kind (non-federal share) contributions: volunteer time, donated goods,
 * services, or facility use. Head Start programs must document a non-federal
 * match (typically 20%); `value` is the dollar amount counted toward it.
 */
export const inKindContributions = mysqlTable("in_kind_contributions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  type: mysqlEnum("type", ["volunteer", "goods", "services", "facility", "other"]).notNull(),
  contributor: varchar("contributor", { length: 200 }).notNull(),
  description: varchar("description", { length: 500 }),
  date: timestamp("date").notNull(),
  /** Volunteer hours, when type = volunteer. */
  hours: decimal("hours", { precision: 7, scale: 2 }),
  /** Dollar value counted toward the non-federal match. */
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InKindContribution = typeof inKindContributions.$inferSelect;
export type InsertInKindContribution = typeof inKindContributions.$inferInsert;

/**
 * Public "request a program" submissions (self-serve onboarding front door).
 * Anyone can submit; the platform owner reviews and, on approval, an
 * organization is created and linked via createdOrgId.
 */
export const programRequests = mysqlTable("program_requests", {
  id: int("id").autoincrement().primaryKey(),
  organizationName: varchar("organizationName", { length: 255 }).notNull(),
  agencyId: varchar("agencyId", { length: 64 }),
  contactName: varchar("contactName", { length: 160 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  message: varchar("message", { length: 1000 }),
  status: mysqlEnum("status", ["pending", "approved", "declined"]).default("pending").notNull(),
  /** organizations.id created when this request is approved; null otherwise. */
  createdOrgId: int("createdOrgId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProgramRequest = typeof programRequests.$inferSelect;
export type InsertProgramRequest = typeof programRequests.$inferInsert;

/**
 * One-time invitation codes that let a parent create a family-app account
 * bound to a specific family. Staff generate these; the family onboarding flow
 * (verify-code → register) consumes them. A code is single-use and expires.
 */
export const familyInvitations = mysqlTable("family_invitations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  /** Short human-enterable code, e.g. "CF-7K2M9Q". Unique while active. */
  code: varchar("code", { length: 16 }).notNull().unique(),
  /** Email the invite was addressed to (informational; registration re-asks). */
  adultEmail: varchar("adultEmail", { length: 320 }),
  /** users.id of the staff member who created the invite. */
  createdBy: int("createdBy"),
  expiresAt: timestamp("expiresAt").notNull(),
  /** Set when a parent registers with this code; null while unused. */
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FamilyInvitation = typeof familyInvitations.$inferSelect;
export type InsertFamilyInvitation = typeof familyInvitations.$inferInsert;

/**
 * Attendance table for tracking daily attendance.
 */
export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  date: timestamp("date").notNull(),
  checkInTime: timestamp("checkInTime"),
  checkOutTime: timestamp("checkOutTime"),
  status: mysqlEnum("status", ["present", "absent", "excused", "half_day"]).default("present"),
  notes: text("notes"),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

/**
 * Health Records table for tracking screenings, immunizations, and exams.
 */
export const healthRecords = mysqlTable("health_records", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  // "developmental" added for the iOS Health Compliance screen's ASQ-style
  // developmental screening deadline — same shape as vision/hearing, just a
  // new category rather than a new table.
  type: mysqlEnum("type", ["immunization", "dental", "physical", "vision", "hearing", "lead", "hemoglobin", "developmental", "other"]).notNull(),
  status: mysqlEnum("status", ["up_to_date", "due_soon", "overdue", "exempt", "not_required"]).default("up_to_date"),
  recordDate: timestamp("recordDate").notNull(),
  expiryDate: timestamp("expiryDate"),
  provider: varchar("provider", { length: 255 }),
  notes: text("notes"),
  recordedBy: int("recordedBy").references(() => staff.id),
  // Only meaningful when status = "exempt" — most state OEC/child-care
  // licensing rules require an exemption to name a *type* and, for
  // medical exemptions, an expiry. A bare status:"exempt" with none of
  // these was a real gap (see participationClearance.ts): it looked
  // compliant but couldn't be verified as an actual valid exemption.
  exemptionType: mysqlEnum("exemptionType", ["medical", "religious", "personal"]),
  exemptionExpiresAt: timestamp("exemptionExpiresAt"),
  exemptionDocumentId: int("exemptionDocumentId").references(() => documents.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HealthRecord = typeof healthRecords.$inferSelect;
export type InsertHealthRecord = typeof healthRecords.$inferInsert;

/**
 * Family Services table for tracking home visits, contacts, and resource referrals.
 * Backs the general staff-activity/contact log (web + iOS "Contacts").
 * Richer, single-purpose logs (home visiting curriculum, referrals) live in
 * their own tables below — see familyHomeVisits, familyReferrals.
 */
export const familyServices = mysqlTable("family_services", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  type: mysqlEnum("type", ["home_visit", "office_visit", "phone_call", "email", "referral", "coordinated_services", "monthly_contact", "other", "in_person", "text", "zoom", "voicemail"]).notNull(),
  serviceDate: timestamp("serviceDate").notNull(),
  description: text("description").notNull(),
  outcome: text("outcome"),
  followUpRequired: int("followUpRequired").default(0),
  followUpDate: timestamp("followUpDate"),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyService = typeof familyServices.$inferSelect;
export type InsertFamilyService = typeof familyServices.$inferInsert;

/**
 * Resource/community-service referrals (housing, food, mental health, etc.) —
 * §1302.14 community partnerships. Distinct from the general contact log:
 * referrals track an external agency relationship through to an outcome.
 */
export const familyReferrals = mysqlTable("family_referrals", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  agencyName: varchar("agencyName", { length: 255 }).notNull(),
  serviceType: mysqlEnum("serviceType", [
    "housing", "food_assistance", "mental_health", "substance_use", "domestic_violence",
    "legal_aid", "employment", "adult_education", "childcare", "medical_care",
    "dental_care", "vision_care", "transportation", "utility_assistance",
    "financial_counseling", "other",
  ]).notNull(),
  referredBy: int("referredBy").references(() => staff.id),
  referralDate: timestamp("referralDate").notNull(),
  followUpDate: timestamp("followUpDate"),
  status: mysqlEnum("status", ["pending", "contacted", "enrolled", "declined", "unavailable", "completed"]).default("pending").notNull(),
  notes: text("notes"),
  outcomeNotes: text("outcomeNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyReferral = typeof familyReferrals.$inferSelect;
export type InsertFamilyReferral = typeof familyReferrals.$inferInsert;

/**
 * Structured home-visiting curriculum log (§1302.36) — richer than a general
 * contact: duration, topics covered, goals discussed, and a GPS-verified
 * location stamp for programs that require visit verification.
 */
export const familyHomeVisits = mysqlTable("family_home_visits", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  visitDate: timestamp("visitDate").notNull(),
  visitType: mysqlEnum("visitType", ["home_visit", "office_visit", "phone_call", "group_social", "community_event"]).notNull(),
  durationMinutes: int("durationMinutes").default(0).notNull(),
  conductedBy: int("conductedBy").references(() => staff.id),
  /** Raw topic-enum strings, e.g. ["child_development", "family_goals"]. */
  topicsCovered: json("topicsCovered").$type<string[]>(),
  notes: text("notes"),
  /** family_goals ids referenced during the visit. */
  goalsMentioned: json("goalsMentioned").$type<string[]>(),
  locationVerified: int("locationVerified").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FamilyHomeVisit = typeof familyHomeVisits.$inferSelect;
export type InsertFamilyHomeVisit = typeof familyHomeVisits.$inferInsert;

/**
 * Family Needs Assessment (FNA) — one current assessment per family, rating
 * six domains (safety, health, learning, engagement, well-being, community).
 * Re-running the assessment overwrites ratings/notes on the same row rather
 * than versioning, matching the iOS "current FNA" model.
 */
export const familyNeedsAssessments = mysqlTable("family_needs_assessments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id).unique(),
  conductedBy: int("conductedBy").references(() => staff.id),
  conductedDate: timestamp("conductedDate").defaultNow().notNull(),
  reviewDate: timestamp("reviewDate"),
  /** [{id, domain, level (1-4), notes}] — one entry per FNA domain. */
  ratings: json("ratings").$type<Array<{ id: string; domain: string; level: number; notes: string }>>().notNull(),
  notes: text("notes"),
  isComplete: int("isComplete").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyNeedsAssessment = typeof familyNeedsAssessments.$inferSelect;
export type InsertFamilyNeedsAssessment = typeof familyNeedsAssessments.$inferInsert;

/**
 * CFCR — Child & Family Case Review. A periodic team meeting (teacher, family
 * advocate, health/disabilities staff, family) reviewing one child's progress
 * across attendance, health, behavior, and development, with action items.
 */
export const cfcrRecords = mysqlTable("cfcr_records", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  meetingDate: timestamp("meetingDate").notNull(),
  /** [{id, name, role, attended}]. */
  participants: json("participants").$type<Array<{ id: string; name: string; role: string; attended: boolean }>>(),
  attendanceNotes: text("attendanceNotes"),
  healthNotes: text("healthNotes"),
  behaviorNotes: text("behaviorNotes"),
  developmentalNotes: text("developmentalNotes"),
  familyGoalNotes: text("familyGoalNotes"),
  /** [{id, description, assignedTo, dueDate, isCompleted}]. */
  actionItems: json("actionItems").$type<Array<{ id: string; description: string; assignedTo: string; dueDate: string | null; isCompleted: boolean }>>(),
  conductedBy: int("conductedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CfcrRecord = typeof cfcrRecords.$inferSelect;
export type InsertCfcrRecord = typeof cfcrRecords.$inferInsert;

/**
 * Family case notes — narrative case-management entries distinct from the
 * general contact log, with a confidentiality flag (sensitive notes, e.g.
 * safety/DV concerns) and follow-up tracking.
 */
export const familyCaseNotes = mysqlTable("family_case_notes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  authorId: int("authorId").references(() => staff.id),
  type: mysqlEnum("type", ["home_visit", "phone_call", "office_visit", "incident", "general"]).notNull(),
  confidentiality: mysqlEnum("confidentiality", ["standard", "sensitive"]).default("standard").notNull(),
  body: text("body").notNull(),
  followUpRequired: int("followUpRequired").default(0).notNull(),
  followUpDue: timestamp("followUpDue"),
  followUpCompleted: int("followUpCompleted").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FamilyCaseNote = typeof familyCaseNotes.$inferSelect;
export type InsertFamilyCaseNote = typeof familyCaseNotes.$inferInsert;

/**
 * Attendance Improvement Plans (AIP) — §1302.16 requires programs to work
 * with families of chronically absent children on a documented improvement
 * plan: barriers, strategies, and a review cadence.
 */
export const attendancePlans = mysqlTable("attendance_plans", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  familyAdvocate: int("familyAdvocate").references(() => staff.id),
  createdDate: timestamp("createdDate").defaultNow().notNull(),
  reviewDate: timestamp("reviewDate"),
  /** Free-text barrier descriptions, e.g. ["Transportation", "Housing instability"]. */
  barriers: json("barriers").$type<string[]>(),
  /** [{id, description, isImplemented, targetDate}]. */
  strategies: json("strategies").$type<Array<{ id: string; description: string; isImplemented: boolean; targetDate: string | null }>>(),
  status: mysqlEnum("status", ["active", "resolved", "closed"]).default("active").notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AttendancePlan = typeof attendancePlans.$inferSelect;
export type InsertAttendancePlan = typeof attendancePlans.$inferInsert;

/**
 * Communication Logs table for tracking sent SMS and Emails.
 */
export const communicationLogs = mysqlTable("communication_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  recipientId: int("recipientId").notNull().references(() => families.id),
  type: mysqlEnum("type", ["sms", "email", "broadcast"]).notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending"),
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  sentAt: timestamp("sentAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommunicationLog = typeof communicationLogs.$inferSelect;
export type InsertCommunicationLog = typeof communicationLogs.$inferInsert;

/**
 * Two-way in-app conversation between program staff and one family.
 * Staff see all conversations in their organization; parent accounts see only
 * the conversation(s) for their own familyId. Per-side read cursors drive the
 * viewer-relative unread counts.
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  /** users.id of whoever started the thread. */
  createdBy: int("createdBy"),
  /** Last time any staff member viewed this thread (ms precision — read
   *  cursors are compared against message sentAt within the same second). */
  staffLastReadAt: timestamp("staffLastReadAt", { fsp: 3 }),
  /** Last time the family viewed this thread. */
  familyLastReadAt: timestamp("familyLastReadAt", { fsp: 3 }),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/** One message inside a conversation. */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id),
  /** users.id of the sender (staff or parent account). */
  senderUserId: int("senderUserId").notNull(),
  senderRole: mysqlEnum("senderRole", ["staff", "family"]).notNull(),
  body: text("body").notNull(),
  /**
   * Cached AI translations of `body`, keyed by language code
   * (e.g. { "es": "...", "en": "..." }). Populated lazily on first read by a
   * viewer whose preferred language differs from the message's language.
   */
  translations: json("translations").$type<Record<string, string>>(),
  /** Millisecond precision; set by the application on insert. */
  sentAt: timestamp("sentAt", { fsp: 3 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Parent-reported absences ("my child is not coming today").
 * Reported from the family app; a family advocate (staff) reviews each one.
 * Approval writes an "excused" attendance row for that child and date and
 * sends the family a notification.
 */
export const absenceReports = mysqlTable("absence_reports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  childId: int("childId").notNull().references(() => children.id),
  /** The day the child will be (or was) absent. */
  absenceDate: timestamp("absenceDate").notNull(),
  reason: mysqlEnum("reason", ["sick", "appointment", "family_emergency", "transportation", "travel", "other"]).notNull(),
  note: text("note"),
  status: mysqlEnum("status", ["pending", "approved", "denied"]).default("pending").notNull(),
  /** users.id of the parent who reported. */
  reportedBy: int("reportedBy"),
  /** users.id of the staff member who reviewed. */
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AbsenceReport = typeof absenceReports.$inferSelect;
export type InsertAbsenceReport = typeof absenceReports.$inferInsert;

/**
 * Family goals with simple progress tracking, shown as progress graphs in the
 * family app. Staff update progress during home visits / case management.
 * Also backs the staff-side SMART-goal editor (Family Services, Head Start
 * module) — description/category/targetDate/completedDate/steps support that
 * richer view; the family app only reads title/progress/status.
 */
export const familyGoals = mysqlTable("family_goals", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  organizationId: int("organizationId").references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  /** 0–100. */
  progress: int("progress").default(0).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed", "on_hold"]).default("not_started").notNull(),
  targetDate: timestamp("targetDate"),
  completedDate: timestamp("completedDate"),
  /** Ordered checklist: [{id, title, isCompleted, dueDate, notes}]. */
  steps: json("steps").$type<Array<{ id: string; title: string; isCompleted: boolean; dueDate: string | null; notes: string | null }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyGoalRow = typeof familyGoals.$inferSelect;
export type InsertFamilyGoalRow = typeof familyGoals.$inferInsert;

/**
 * Education table for tracking individualized curriculum and assessments.
 */
export const educationRecords = mysqlTable("education_records", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  type: mysqlEnum("type", ["assessment", "parent_conference", "home_visit", "individual_plan"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assessmentDate: timestamp("assessmentDate").notNull(),
  score: varchar("score", { length: 50 }),
  /** Developmental domain (e.g. DRDP: ATL-REG, SED, LLD, COG, PD-HLTH). */
  domain: varchar("domain", { length: 80 }),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EducationRecord = typeof educationRecords.$inferSelect;
export type InsertEducationRecord = typeof educationRecords.$inferInsert;

/**
 * PIR (Program Information Report) value store — one row per answered field.
 * The federal annual report (OMB 0970-0427). Question definitions live in
 * pirQuestions; report lifecycle in pirReports.
 */
export const pirData = mysqlTable("pir_data", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  year: varchar("year", { length: 9 }).notNull(), // e.g., "2024-2025"
  section: varchar("section", { length: 100 }).notNull(), // e.g., "Section A: Enrollment"
  /**
   * The PIR field this value answers. Matches pirQuestions.code (the catalog
   * slug, e.g. "program_information.enrollment.funded_enrollment"). Widened to
   * 120 chars so the full catalog code fits; legacy free-text ids still work.
   */
  questionId: varchar("questionId", { length: 120 }).notNull(),
  value: text("value").notNull(),
  /**
   * The report envelope this value belongs to (pirReports.id). Null for values
   * recorded before a report row existed; backfill by (organizationId, year).
   */
  reportId: int("reportId").references(() => pirReports.id),
  updatedBy: int("updatedBy").references(() => staff.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PirData = typeof pirData.$inferSelect;
export type InsertPirData = typeof pirData.$inferInsert;

/**
 * One PIR submission envelope per program per reporting year. Groups the
 * individual pir_data values and tracks the draft → submitted → accepted
 * lifecycle. Org-scoped like every other tenant table; unique per
 * (organizationId, year) so a program has exactly one report per year.
 */
export const pirReports = mysqlTable("pir_reports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  /** Reporting year, e.g. "2024-2025" — matches pir_data.year. */
  year: varchar("year", { length: 9 }).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "accepted"]).default("draft").notNull(),
  /** staff.id who submitted (mirrors pir_data.updatedBy); null while a draft. */
  submittedBy: int("submittedBy").references(() => staff.id),
  submittedAt: timestamp("submittedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  orgYear: unique("pir_reports_org_year").on(t.organizationId, t.year),
}));

export type PirReport = typeof pirReports.$inferSelect;
export type InsertPirReport = typeof pirReports.$inferInsert;

/**
 * Canonical catalog of PIR fields, seeded from docs/pir/pir-catalog.json via
 * scripts/seed-pir-questions.ts. Reference data shared across ALL orgs — NOT
 * tenant-scoped. pir_data.questionId references `code` here.
 *
 * NOTE: `code` slugs and `sortOrder` are app-internal, not official OMB
 * question numbers. Reconcile against the official form PDF before treating the
 * catalog as complete (see docs/pir/PIR_REFERENCE.md).
 */
export const pirQuestions = mysqlTable("pir_questions", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable catalog slug, e.g. "child_family_services.bmi.obese". Unique. */
  code: varchar("code", { length: 120 }).notNull().unique(),
  /** Section id slug, e.g. "child_family_services". */
  sectionId: varchar("sectionId", { length: 48 }).notNull(),
  /** Human section title, e.g. "Section C — Child and Family Services". */
  section: varchar("section", { length: 120 }).notNull(),
  /** Subsection id slug, e.g. "bmi" (null for section-level fields). */
  subsectionId: varchar("subsectionId", { length: 64 }),
  /** Human subsection title. */
  subsection: varchar("subsection", { length: 200 }),
  label: varchar("label", { length: 400 }).notNull(),
  valueType: mysqlEnum("valueType", ["integer", "percent", "boolean", "enum", "text"]).default("integer").notNull(),
  subject: mysqlEnum("subject", ["child", "family", "staff", "program", "grant"]).notNull(),
  /** Allowed choices when valueType = enum. Null otherwise. */
  options: json("options").$type<string[]>(),
  /** "enrollment" / "eoy" for fields reported at both points in time; null otherwise. */
  paired: mysqlEnum("paired", ["enrollment", "eoy"]),
  note: text("note"),
  /** Display order across the whole catalog. */
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PirQuestion = typeof pirQuestions.$inferSelect;
export type InsertPirQuestion = typeof pirQuestions.$inferInsert;

/**
 * Classrooms table for organizing children by classroom.
 */
export const classrooms = mysqlTable("classrooms", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  ageGroup: varchar("ageGroup", { length: 50 }), // e.g., "Infants", "Toddlers", "Preschool"
  capacity: int("capacity").default(15),
  teacherId: int("teacherId").references(() => staff.id),
  assistantId: int("assistantId").references(() => staff.id),
  color: varchar("color", { length: 7 }).default("#3b82f6"), // Hex color for UI
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Classroom = typeof classrooms.$inferSelect;
export type InsertClassroom = typeof classrooms.$inferInsert;

/**
 * Child-Classroom assignment table (many-to-many).
 */
export const childClassroomAssignments = mysqlTable("child_classroom_assignments", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  classroomId: int("classroomId").notNull().references(() => classrooms.id),
  assignmentDate: timestamp("assignmentDate").defaultNow(),
  endDate: timestamp("endDate"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChildClassroomAssignment = typeof childClassroomAssignments.$inferSelect;
export type InsertChildClassroomAssignment = typeof childClassroomAssignments.$inferInsert;

/**
 * Staff Caseload table (which classrooms a staff member is responsible for).
 */
export const staffCaseloads = mysqlTable("staff_caseloads", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull().references(() => staff.id),
  classroomId: int("classroomId").notNull().references(() => classrooms.id),
  role: mysqlEnum("role", ["teacher", "assistant", "coordinator"]).default("teacher"),
  isActive: int("isActive").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StaffCaseload = typeof staffCaseloads.$inferSelect;
export type InsertStaffCaseload = typeof staffCaseloads.$inferInsert;

/**
 * Student Notes table for pinned/important notes on each child.
 */
export const studentNotes = mysqlTable("student_notes", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium"),
  isPinned: int("isPinned").default(0), // 1 = pinned to top
  category: varchar("category", { length: 50 }), // e.g., "Allergy", "Behavior", "Medical", "General"
  expiryDate: timestamp("expiryDate"), // Optional: note expires after this date
  createdBy: int("createdBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentNote = typeof studentNotes.$inferSelect;
export type InsertStudentNote = typeof studentNotes.$inferInsert;

/**
 * Program Calendar Events table for tracking school events, holidays, and important dates.
 */
export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventType: mysqlEnum("eventType", ["holiday", "school_event", "parent_event", "staff_training", "deadline", "other"]).default("other"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  location: varchar("location", { length: 255 }),
  classroomId: int("classroomId").references(() => classrooms.id), // Optional: specific to a classroom
  allDay: int("allDay").default(1),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  createdBy: int("createdBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

/**
 * Family Contact Addresses table for managing multiple addresses per family.
 */
export const familyContactAddresses = mysqlTable("family_contact_addresses", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  contactName: varchar("contactName", { length: 100 }).notNull(),
  relationship: varchar("relationship", { length: 50 }), // e.g., "Mother", "Father", "Grandmother"
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  isPrimary: int("isPrimary").default(0),
  // Licensing-relevant authorization flags — previously this was one
  // undifferentiated contact list with no way to tell "may pick this
  // child up" apart from "may consent to emergency medical treatment"
  // apart from "just an informational contact." Both default to the
  // pre-existing implicit behavior (any listed contact was treated as
  // pickup-authorized; none were treated as medical-consent-authorized)
  // so existing rows don't silently change meaning.
  authorizedPickup: int("authorizedPickup").default(1),
  authorizedEmergencyMedical: int("authorizedEmergencyMedical").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyContactAddress = typeof familyContactAddresses.$inferSelect;
export type InsertFamilyContactAddress = typeof familyContactAddresses.$inferInsert;


/**
 * Documents table for storing digital files (birth certificates, immunization records, consent forms).
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  // Nullable: the iOS "upload now, file to a child's profile later" flow
  // creates a document before a child is chosen.
  childId: int("childId").references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  documentType: mysqlEnum("documentType", ["birth_certificate", "immunization_record", "consent_form", "medical_record", "assessment", "other", "iep", "enrollment"]).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(), // S3 or cloud storage URL
  fileSize: int("fileSize"), // in bytes
  mimeType: varchar("mimeType", { length: 100 }), // e.g., "application/pdf"
  expiryDate: timestamp("expiryDate"), // Optional: for documents that expire
  uploadedBy: int("uploadedBy").notNull().references(() => staff.id),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Bulk Action Logs table for tracking bulk operations (attendance, health screenings, notes).
 */
export const bulkActionLogs = mysqlTable("bulk_action_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  classroomId: int("classroomId").notNull().references(() => classrooms.id),
  actionType: mysqlEnum("actionType", ["bulk_attendance", "bulk_health_screening", "bulk_notes", "bulk_enrollment"]).notNull(),
  description: text("description"),
  recordCount: int("recordCount").notNull(), // Number of children affected
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending"),
  performedBy: int("performedBy").notNull().references(() => staff.id),
  actionDate: timestamp("actionDate").defaultNow(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BulkActionLog = typeof bulkActionLogs.$inferSelect;
export type InsertBulkActionLog = typeof bulkActionLogs.$inferInsert;

/**
 * AI Insights table for storing AI-generated summaries and recommendations.
 */
export const aiInsights = mysqlTable("ai_insights", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  insightType: mysqlEnum("insightType", ["case_summary", "compliance_flag", "health_alert", "behavioral_note", "recommendation"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium"),
  actionRequired: int("actionRequired").default(0),
  dismissedAt: timestamp("dismissedAt"),
  generatedAt: timestamp("generatedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = typeof aiInsights.$inferInsert;


// ==================== BILLING & PAYMENTS ====================
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("dueDate").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "cancelled"]).default("draft").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Recurring tuition plans: the rate agreement behind auto-generated invoices.
 * `nextInvoiceDate` advances by one period each time an invoice is generated,
 * so generation is idempotent — running it twice in a day creates nothing new.
 */
export const billingPlans = mysqlTable("billing_plans", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  /** Optional per-child rate (e.g. sibling discounts); null = family-level plan. */
  childId: int("childId").references(() => children.id),
  name: varchar("name", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: mysqlEnum("frequency", ["weekly", "biweekly", "monthly"]).default("monthly").notNull(),
  /** Next date an invoice should be generated for. */
  nextInvoiceDate: date("nextInvoiceDate").notNull(),
  isActive: int("isActive").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BillingPlan = typeof billingPlans.$inferSelect;
export type InsertBillingPlan = typeof billingPlans.$inferInsert;

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull().references(() => invoices.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["credit_card", "ach", "check", "cash"]).notNull(),
  stripePaymentId: varchar("stripePaymentId", { length: 255 }),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  transactionDate: timestamp("transactionDate").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ==================== PARENT ENGAGEMENT PORTAL ====================
export const activityLogs = mysqlTable("activityLogs", {
  id: int("id").autoincrement().primaryKey(),
  childId: int("childId").notNull().references(() => children.id),
  staffId: int("staffId").notNull().references(() => staff.id),
  activityType: mysqlEnum("activityType", ["meal", "nap", "diaper", "activity", "note", "photo"]).notNull(),
  description: text("description"),
  /**
   * Optional media for a moment. With the storage proxy configured this is a
   * small public URL; in dev it falls back to a client-resized image data URL.
   */
  mediaUrl: mediumtext("mediaUrl"),
  mediaType: mysqlEnum("mediaType", ["image", "video"]),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

export const parentNotifications = mysqlTable("parentNotifications", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["activity", "alert", "announcement", "photo"]).notNull(),
  isRead: int("isRead").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ParentNotification = typeof parentNotifications.$inferSelect;
export type InsertParentNotification = typeof parentNotifications.$inferInsert;

// ==================== ELECTRONIC SIGNATURES ====================
export const digitalDocuments = mysqlTable("digitalDocuments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  // Nullable: most digital documents (enrollment packets, general waivers)
  // are family-wide. Emergency medical consent specifically needs to be
  // tied to one child (a family with multiple enrolled children may
  // authorize different treatment consents per child), so this lets a
  // document optionally scope down from family-level to child-level
  // without needing a second, parallel table.
  childId: int("childId").references(() => children.id),
  documentType: mysqlEnum("documentType", ["enrollment", "consent", "waiver", "health_form", "iep", "emergency_medical_consent"]).notNull(),
  documentUrl: varchar("documentUrl", { length: 512 }).notNull(),
  signatureUrl: varchar("signatureUrl", { length: 512 }),
  signedBy: varchar("signedBy", { length: 255 }),
  signedAt: timestamp("signedAt"),
  status: mysqlEnum("status", ["pending", "signed", "expired"]).default("pending").notNull(),
  expiresAt: date("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DigitalDocument = typeof digitalDocuments.$inferSelect;
export type InsertDigitalDocument = typeof digitalDocuments.$inferInsert;

// ==================== CACFP & MEAL PLANNING ====================
export const mealPlans = mysqlTable("mealPlans", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  classroomId: int("classroomId").notNull().references(() => classrooms.id),
  weekStartDate: date("weekStartDate").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "served"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = typeof mealPlans.$inferInsert;

export const mealItems = mysqlTable("mealItems", {
  id: int("id").autoincrement().primaryKey(),
  mealPlanId: int("mealPlanId").notNull().references(() => mealPlans.id),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  mealType: mysqlEnum("mealType", ["breakfast", "snack", "lunch", "afternoon_snack"]).notNull(),
  description: text("description").notNull(),
  servings: int("servings"),
  cacfpCompliant: int("cacfpCompliant").default(1),
});

export type MealItem = typeof mealItems.$inferSelect;
export type InsertMealItem = typeof mealItems.$inferInsert;

// ==================== LESSON PLANNING & CURRICULUM ====================
/**
 * Weekly lesson plan for one classroom (Lillio-style curriculum planning).
 * Holds the week's theme; individual activities live in lessonActivities.
 */
export const lessonPlans = mysqlTable("lesson_plans", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  classroomId: int("classroomId").notNull().references(() => classrooms.id),
  weekStartDate: date("weekStartDate").notNull(),
  title: varchar("title", { length: 255 }),
  theme: varchar("theme", { length: 255 }),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  createdBy: int("createdBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonPlan = typeof lessonPlans.$inferSelect;
export type InsertLessonPlan = typeof lessonPlans.$inferInsert;

/**
 * One planned activity within a lesson plan, scheduled to a weekday and tagged
 * with the developmental domain it targets (aligned to ELOF-style domains).
 */
export const lessonActivities = mysqlTable("lesson_activities", {
  id: int("id").autoincrement().primaryKey(),
  lessonPlanId: int("lessonPlanId").notNull().references(() => lessonPlans.id),
  dayOfWeek: mysqlEnum("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  /** Developmental domain this activity targets. */
  domain: mysqlEnum("domain", ["social_emotional", "language_literacy", "cognition", "physical", "creative_arts", "approaches_to_learning"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LessonActivity = typeof lessonActivities.$inferSelect;
export type InsertLessonActivity = typeof lessonActivities.$inferInsert;

// ==================== CHILD PORTFOLIOS ====================
/**
 * A developmental portfolio entry — a curated observation/work sample for one
 * child, tagged with the developmental domain it documents (Lillio-style
 * portfolios). Builds a timeline of a child's growth over the year.
 */
export const portfolioEntries = mysqlTable("portfolio_entries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  title: varchar("title", { length: 255 }).notNull(),
  observation: text("observation"),
  domain: mysqlEnum("domain", ["social_emotional", "language_literacy", "cognition", "physical", "creative_arts", "approaches_to_learning"]),
  /** Optional photo/work-sample URL (upload pipeline TBD). */
  mediaUrl: text("mediaUrl"),
  observedAt: date("observedAt"),
  createdBy: int("createdBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioEntry = typeof portfolioEntries.$inferSelect;
export type InsertPortfolioEntry = typeof portfolioEntries.$inferInsert;

// ==================== SUBSIDY TRACKING ====================
/**
 * A child-care subsidy/voucher for a family — the funding agency, the
 * authorized amount, the family's co-pay, and the coverage window. Tracked
 * alongside Billing so staff see who's subsidized and what families owe.
 */
export const subsidies = mysqlTable("subsidies", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  familyId: int("familyId").notNull().references(() => families.id),
  agencyName: varchar("agencyName", { length: 200 }).notNull(),
  /** Case/authorization number from the subsidy agency. */
  caseNumber: varchar("caseNumber", { length: 100 }),
  authorizedAmount: decimal("authorizedAmount", { precision: 10, scale: 2 }),
  copayAmount: decimal("copayAmount", { precision: 10, scale: 2 }),
  startDate: date("startDate"),
  endDate: date("endDate"),
  status: mysqlEnum("status", ["active", "pending", "expired"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subsidy = typeof subsidies.$inferSelect;
export type InsertSubsidy = typeof subsidies.$inferInsert;

// ==================== PUSH NOTIFICATIONS ====================
/**
 * A device's push token (APNs/FCM) for one user. Sending to a family resolves
 * the parent user(s) for that family and pushes to all their devices.
 */
export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  platform: mysqlEnum("platform", ["ios", "android", "web"]).default("ios").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = typeof deviceTokens.$inferInsert;

export const cacfpReports = mysqlTable("cacfpReports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  reportMonth: date("reportMonth").notNull(),
  mealsServed: int("mealsServed").default(0),
  reimbursementAmount: decimal("reimbursementAmount", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["draft", "submitted", "approved"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CacfpReport = typeof cacfpReports.$inferSelect;
export type InsertCacfpReport = typeof cacfpReports.$inferInsert;

// ==================== STAFF OPERATIONS ====================
export const timeClock = mysqlTable("timeClock", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull().references(() => staff.id),
  clockInTime: timestamp("clockInTime").notNull(),
  clockOutTime: timestamp("clockOutTime"),
  hoursWorked: decimal("hoursWorked", { precision: 5, scale: 2 }),
  date: date("date").notNull(),
});

export type TimeClock = typeof timeClock.$inferSelect;
export type InsertTimeClock = typeof timeClock.$inferInsert;

export const certifications = mysqlTable("certifications", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull().references(() => staff.id),
  certificationType: varchar("certificationType", { length: 255 }).notNull(),
  issueDate: date("issueDate").notNull(),
  expiryDate: date("expiryDate").notNull(),
  certificationNumber: varchar("certificationNumber", { length: 255 }),
  documentUrl: varchar("documentUrl", { length: 512 }),
  status: mysqlEnum("status", ["active", "expiring_soon", "expired"]).default("active").notNull(),
});

export type Certification = typeof certifications.$inferSelect;
export type InsertCertification = typeof certifications.$inferInsert;

// ==================== ADVANCED REPORTING ====================
export const customReports = mysqlTable("customReports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  reportName: varchar("reportName", { length: 255 }).notNull(),
  reportType: mysqlEnum("reportType", ["enrollment", "attendance", "health", "compliance", "financial", "custom"]).notNull(),
  filters: json("filters"),
  columns: json("columns"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastRunAt: timestamp("lastRunAt"),
});

export type CustomReport = typeof customReports.$inferSelect;
export type InsertCustomReport = typeof customReports.$inferInsert;

export const reportResults = mysqlTable("reportResults", {
  id: int("id").autoincrement().primaryKey(),
  customReportId: int("customReportId").notNull().references(() => customReports.id),
  resultData: json("resultData").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  exportFormat: mysqlEnum("exportFormat", ["pdf", "excel", "csv"]),
  fileUrl: varchar("fileUrl", { length: 512 }),
});

export type ReportResult = typeof reportResults.$inferSelect;
export type InsertReportResult = typeof reportResults.$inferInsert;

// NOTE: audit_logs is defined once near the top of this file (resourceType /
// resourceId / actorOpenId / detail — matches migration 0003 and the
// insertAuditLog/auditAccess code). A duplicate scaffold definition that a
// parallel branch added here was removed; do not re-add it.

/**
 * Family Partnership Agreements (Head Start §1302.52).
 * One active agreement per family; goals live in family_goals and home visits
 * in family_services (type "home_visit") — this row ties them together with
 * strengths, needs, signatures, and a review cadence.
 */
export const familyPartnershipAgreements = mysqlTable("family_partnership_agreements", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  status: mysqlEnum("status", ["draft", "active", "review_due", "completed", "expired"])
    .default("draft")
    .notNull(),
  /** Family strengths identified during the assessment (JSON string array). */
  strengths: json("strengths").$type<string[]>(),
  needsAssessment: text("needsAssessment"),
  /** Home visits promised for the program year (Head Start home-based: 46; center-based: 2). */
  targetVisits: int("targetVisits").default(2).notNull(),
  parentSigned: int("parentSigned").default(0).notNull(),
  parentSignedAt: timestamp("parentSignedAt"),
  staffSigned: int("staffSigned").default(0).notNull(),
  staffSignedAt: timestamp("staffSignedAt"),
  reviewDate: timestamp("reviewDate"),
  createdBy: int("createdBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyPartnershipAgreement = typeof familyPartnershipAgreements.$inferSelect;
export type InsertFamilyPartnershipAgreement = typeof familyPartnershipAgreements.$inferInsert;

/**
 * Suspension / expulsion incidents (Head Start §1302.17).
 * Programs must prohibit expulsion, severely limit suspension, and document
 * the steps taken to address behavior before any exclusion. `stepsTaken`
 * records which required interventions happened (JSON string array).
 */
export const suspensionExpulsionLogs = mysqlTable("suspension_expulsion_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  incidentDate: timestamp("incidentDate").notNull(),
  type: mysqlEnum("type", ["temporary_suspension", "expulsion_prevented", "transition_out"]).notNull(),
  description: text("description").notNull(),
  /** Which §1302.17 interventions were completed (e.g. mental_health_consult). */
  stepsTaken: json("stepsTaken").$type<string[]>(),
  outcome: text("outcome"),
  status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  recordedBy: int("recordedBy").references(() => staff.id),
  // Added for the iOS SuspensionExpulsionLog screen, which tracks each
  // §1302.17 intervention as its own discrete date rather than the web's
  // single `stepsTaken` list, plus a state-agency notification step (required
  // before an actual expulsion) that the web feature never needed to record.
  // All additive/nullable — existing rows and the web ERSEA feature are
  // unaffected.
  incidentTypeDetail: varchar("incidentTypeDetail", { length: 64 }),
  mentalHealthConsultDate: timestamp("mentalHealthConsultDate"),
  familyMeetingDate: timestamp("familyMeetingDate"),
  behaviourSupportPlanDate: timestamp("behaviourSupportPlanDate"),
  stateAgencyNotified: int("stateAgencyNotified").default(0),
  stateNotificationDate: timestamp("stateNotificationDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SuspensionExpulsionLog = typeof suspensionExpulsionLogs.$inferSelect;
export type InsertSuspensionExpulsionLog = typeof suspensionExpulsionLogs.$inferInsert;

/**
 * Policy Council (Head Start §1302.50–51). Programs must maintain a council
 * where parents of currently enrolled children hold the majority of seats.
 */
export const policyCouncilMembers = mysqlTable("policy_council_members", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  name: varchar("name", { length: 200 }).notNull(),
  memberType: mysqlEnum("memberType", ["parent", "community_rep"]).notNull(),
  councilRole: mysqlEnum("councilRole", ["chair", "vice_chair", "secretary", "treasurer", "member"])
    .default("member")
    .notNull(),
  familyId: int("familyId").references(() => families.id),
  termStart: timestamp("termStart"),
  termEnd: timestamp("termEnd"),
  status: mysqlEnum("status", ["active", "ended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PolicyCouncilMember = typeof policyCouncilMembers.$inferSelect;
export type InsertPolicyCouncilMember = typeof policyCouncilMembers.$inferInsert;

export const policyCouncilMeetings = mysqlTable("policy_council_meetings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  meetingDate: timestamp("meetingDate").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  minutes: text("minutes"),
  attendeeCount: int("attendeeCount").default(0).notNull(),
  quorumMet: int("quorumMet").default(0).notNull(),
  /** Open follow-ups from the meeting (JSON string array). */
  actionItems: json("actionItems").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PolicyCouncilMeeting = typeof policyCouncilMeetings.$inferSelect;
export type InsertPolicyCouncilMeeting = typeof policyCouncilMeetings.$inferInsert;

/**
 * Children with disabilities — IEP/IFSP coordination (Head Start §1302.60–63).
 * Tracks the 10% enrollment requirement, plan expirations, LEA coordination,
 * parent rights notification (in the family's language), and kindergarten
 * transition planning.
 */
export const disabilityServices = mysqlTable("disability_services", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  planType: mysqlEnum("planType", ["iep", "ifsp", "section_504"]).notNull(),
  status: mysqlEnum("status", ["pending_evaluation", "active", "expired", "exited"])
    .default("active")
    .notNull(),
  primaryDisability: varchar("primaryDisability", { length: 200 }),
  effectiveDate: timestamp("effectiveDate"),
  /** Annual review / plan expiration date. */
  expirationDate: timestamp("expirationDate"),
  leaAgency: varchar("leaAgency", { length: 200 }),
  leaContact: varchar("leaContact", { length: 200 }),
  parentRightsNotifiedAt: timestamp("parentRightsNotifiedAt"),
  parentRightsLanguage: varchar("parentRightsLanguage", { length: 32 }),
  /** Completed kindergarten-transition steps (JSON string array). */
  transitionChecklist: json("transitionChecklist").$type<string[]>(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DisabilityService = typeof disabilityServices.$inferSelect;
export type InsertDisabilityService = typeof disabilityServices.$inferInsert;

/**
 * Head Start grant budget compliance (Tier-3 roadmap #12).
 * Budget lines per fiscal year and Head Start cost category, plus expenses
 * recorded against them. Non-federal share combines expenses flagged as
 * match with in_kind_contributions (§75.306 — 20% match requirement).
 */
export const grantBudgetLines = mysqlTable("grant_budget_lines", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  /** e.g. "2025-2026" — matches the PIR program-year format. */
  fiscalYear: varchar("fiscalYear", { length: 9 }).notNull(),
  category: mysqlEnum("category", [
    "education", "health", "disability_services", "family_services",
    "program_management", "transportation", "facilities", "tta", "other",
  ]).notNull(),
  budgetedCents: int("budgetedCents").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GrantBudgetLine = typeof grantBudgetLines.$inferSelect;
export type InsertGrantBudgetLine = typeof grantBudgetLines.$inferInsert;

export const grantExpenses = mysqlTable("grant_expenses", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  fiscalYear: varchar("fiscalYear", { length: 9 }).notNull(),
  category: mysqlEnum("category", [
    "education", "health", "disability_services", "family_services",
    "program_management", "transportation", "facilities", "tta", "other",
  ]).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amountCents: int("amountCents").notNull(),
  expenseDate: timestamp("expenseDate").notNull(),
  /** 1 = paid from local funds; counts toward the 20% non-federal share. */
  nonFederalShare: int("nonFederalShare").default(0).notNull(),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GrantExpense = typeof grantExpenses.$inferSelect;
export type InsertGrantExpense = typeof grantExpenses.$inferInsert;

/**
 * Classroom quality observations (Tier-3 roadmap #13).
 * CLASS® (1–7 per dimension, three domains) and ECERS checklists. OHS uses
 * CLASS scores in federal reviews — tracking proactively beats being surprised.
 */
export const classroomAssessments = mysqlTable("classroom_assessments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  classroomId: int("classroomId").notNull().references(() => classrooms.id),
  tool: mysqlEnum("tool", ["class", "ecers"]).notNull(),
  assessmentDate: timestamp("assessmentDate").notNull(),
  observer: varchar("observer", { length: 200 }),
  /** Dimension/subscale → score (1–7), keyed by stable slug. */
  scores: json("scores").$type<Record<string, number>>().notNull(),
  coachingNotes: text("coachingNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClassroomAssessment = typeof classroomAssessments.$inferSelect;
export type InsertClassroomAssessment = typeof classroomAssessments.$inferInsert;

/**
 * Fire/lockdown/severe-weather safety drills. New for the iOS staff app's
 * Health Compliance screen — previously called an endpoint that didn't exist.
 */
export const safetyDrillLogs = mysqlTable("safety_drill_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  drillType: varchar("drillType", { length: 64 }).notNull(),
  drillDate: timestamp("drillDate").notNull(),
  conductedBy: int("conductedBy").references(() => staff.id),
  durationMinutes: int("durationMinutes").default(0).notNull(),
  participantCount: int("participantCount").default(0).notNull(),
  notes: text("notes"),
  issuesFound: text("issuesFound"),
  resolvedDate: timestamp("resolvedDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SafetyDrillLog = typeof safetyDrillLogs.$inferSelect;
export type InsertSafetyDrillLog = typeof safetyDrillLogs.$inferInsert;

/**
 * Mental health consultant visits — either about a specific child or
 * program-wide (childId null). New for the iOS Health Compliance screen.
 */
export const mentalHealthConsults = mysqlTable("mental_health_consults", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").references(() => children.id),
  consultDate: timestamp("consultDate").notNull(),
  consultantName: varchar("consultantName", { length: 200 }).notNull(),
  consultType: varchar("consultType", { length: 64 }).notNull(),
  summary: text("summary"),
  followUpDate: timestamp("followUpDate"),
  followUpNotes: text("followUpNotes"),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MentalHealthConsult = typeof mentalHealthConsults.$inferSelect;
export type InsertMentalHealthConsult = typeof mentalHealthConsults.$inferInsert;

/**
 * ERSEA eligibility/selection records (§1302.12–14). Represents an applicant
 * from initial income/categorical-eligibility determination through
 * enrollment or withdrawal — may exist before the child has an enrolled
 * `children` row at all, so `childId` is a soft link (nullable, no FK) and
 * the applicant's name/DOB are captured directly. New for the iOS ERSEA
 * screen, which previously called an endpoint that didn't exist.
 */
export const eligibilityRecords = mysqlTable("eligibility_records", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childName: varchar("childName", { length: 200 }).notNull(),
  childDateOfBirth: timestamp("childDateOfBirth").notNull(),
  familyId: int("familyId").references(() => families.id),
  applicationDate: timestamp("applicationDate").notNull(),
  householdSize: int("householdSize").notNull(),
  annualIncomeCents: int("annualIncomeCents").notNull(),
  incomeSource: varchar("incomeSource", { length: 255 }),
  categoricalEligibility: varchar("categoricalEligibility", { length: 100 }).notNull(),
  priorityScore: int("priorityScore").default(0).notNull(),
  riskFactors: json("riskFactors").$type<string[]>(),
  status: varchar("status", { length: 64 }).notNull(),
  enrolledDate: timestamp("enrolledDate"),
  classroom: varchar("classroom", { length: 200 }),
  waitlistPosition: int("waitlistPosition"),
  notes: text("notes"),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EligibilityRecordRow = typeof eligibilityRecords.$inferSelect;
export type InsertEligibilityRecord = typeof eligibilityRecords.$inferInsert;

/**
 * CACFP nutrition forms (§226 meal-program recordkeeping) — three related
 * one-per-child paper forms digitized for the iOS Nutrition Forms screen,
 * which previously called endpoints that didn't exist.
 */
export const nutritionPreferenceForms = mysqlTable("nutrition_preference_forms", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  classroom: varchar("classroom", { length: 200 }),
  completedDate: timestamp("completedDate").notNull(),
  parentName: varchar("parentName", { length: 200 }),
  /** Array of { id, foodGroup, item, preference } — see FoodPreferenceEntry (iOS). */
  preferences: json("preferences").$type<Array<{ id: string; foodGroup: string; item: string; preference: string }>>(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NutritionPreferenceForm = typeof nutritionPreferenceForms.$inferSelect;
export type InsertNutritionPreferenceForm = typeof nutritionPreferenceForms.$inferInsert;

export const nutritionInfantFormulaForms = mysqlTable("nutrition_infant_formula_forms", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  classroom: varchar("classroom", { length: 200 }),
  completedDate: timestamp("completedDate").notNull(),
  parentName: varchar("parentName", { length: 200 }),
  formulaBrand: varchar("formulaBrand", { length: 200 }),
  formulaType: varchar("formulaType", { length: 200 }),
  preparationInstructions: text("preparationInstructions"),
  feedingSchedule: text("feedingSchedule"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NutritionInfantFormulaForm = typeof nutritionInfantFormulaForms.$inferSelect;
export type InsertNutritionInfantFormulaForm = typeof nutritionInfantFormulaForms.$inferInsert;

export const nutritionMedicalStatements = mysqlTable("nutrition_medical_statements", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  childId: int("childId").notNull().references(() => children.id),
  classroom: varchar("classroom", { length: 200 }),
  physicianName: varchar("physicianName", { length: 200 }),
  physicianPhone: varchar("physicianPhone", { length: 32 }),
  diagnosis: text("diagnosis"),
  foodsToAvoid: json("foodsToAvoid").$type<string[]>(),
  substitutions: text("substitutions"),
  signedDate: timestamp("signedDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NutritionMedicalStatement = typeof nutritionMedicalStatements.$inferSelect;
export type InsertNutritionMedicalStatement = typeof nutritionMedicalStatements.$inferInsert;

/**
 * Family engagement events (parent orientations, family nights, workshops,
 * etc.) with three pre/day-of/post checklists. New for the iOS Events
 * screen, which previously called an endpoint that didn't exist.
 */
export const familyEngagementEvents = mysqlTable("family_engagement_events", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  plannedDate: timestamp("plannedDate").notNull(),
  actualDate: timestamp("actualDate"),
  location: varchar("location", { length: 255 }),
  createdBy: int("createdBy").references(() => staff.id),
  objectives: json("objectives").$type<string[]>(),
  /** Each checklist is an array of { id, title, isComplete, notes } — see EventChecklistItem (iOS). */
  preEventChecklist: json("preEventChecklist").$type<Array<{ id: string; title: string; isComplete: boolean; notes: string }>>(),
  dayOfChecklist: json("dayOfChecklist").$type<Array<{ id: string; title: string; isComplete: boolean; notes: string }>>(),
  postEventChecklist: json("postEventChecklist").$type<Array<{ id: string; title: string; isComplete: boolean; notes: string }>>(),
  expectedAttendance: int("expectedAttendance").default(0),
  actualAttendance: int("actualAttendance"),
  notes: text("notes"),
  status: varchar("status", { length: 32 }).default("Planning").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyEngagementEventRow = typeof familyEngagementEvents.$inferSelect;
export type InsertFamilyEngagementEvent = typeof familyEngagementEvents.$inferInsert;

/**
 * Per-session staff training-hour logs — backs the iOS Staff screen's "Log
 * Training Hours" action, which previously only mutated local state (no
 * concept of tracked training existed anywhere; `staff.trainingHours` was a
 * hardcoded 0 placeholder, see server/staffDirectory.ts).
 */
export const staffTrainingLogs = mysqlTable("staff_training_logs", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull().references(() => staff.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  trainingName: varchar("trainingName", { length: 255 }).notNull(),
  hours: decimal("hours", { precision: 5, scale: 2 }).notNull(),
  trainingDate: timestamp("trainingDate").notNull(),
  notes: text("notes"),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StaffTrainingLog = typeof staffTrainingLogs.$inferSelect;
export type InsertStaffTrainingLog = typeof staffTrainingLogs.$inferInsert;

/**
 * Generic program-monitoring checklist — shared backing for both the web
 * Compliance page's "Program Monitoring Checklist" (client/src/pages/
 * Compliance.tsx, previously local-state-only per its own code comment) and
 * the iOS Compliance screen's MonitoringChecklistView (previously hardcoded
 * @State, no persistence at all). `itemKey` is a stable slug for a
 * well-known checklist item (e.g. "fire_drill_log") so both platforms can
 * upsert by (organizationId, itemKey) rather than needing a shared ID
 * scheme; label/category travel with the row so the item is
 * self-describing without a second lookup table.
 */
export const complianceChecklistItems = mysqlTable("compliance_checklist_items", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  itemKey: varchar("itemKey", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  isCompliant: int("isCompliant").default(0),
  note: text("note"),
  reviewedBy: int("reviewedBy").references(() => staff.id),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  orgItem: unique("compliance_checklist_items_org_item").on(t.organizationId, t.itemKey),
}));

export type ComplianceChecklistItem = typeof complianceChecklistItems.$inferSelect;
export type InsertComplianceChecklistItem = typeof complianceChecklistItems.$inferInsert;

/**
 * Program "Story" feed (iOS Sources/Story/ProgramStoryView.swift) — a
 * classroom-facing update/photo feed for families. Previously entirely
 * mocked client-side (four hardcoded fixtures reloaded on every launch,
 * "Post"/"Like"/"Comment" all local-array-only). Minimal real schema: one
 * post table plus two child tables for likes/comments, org- and
 * (optionally) classroom-scoped.
 */
export const storyPosts = mysqlTable("story_posts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  classroomId: int("classroomId").references(() => classrooms.id),
  authorStaffId: int("authorStaffId").references(() => staff.id),
  content: text("content").notNull(),
  photoUrl: varchar("photoUrl", { length: 512 }),
  /** Who can see the post — the iOS composer's audience picker. */
  audience: mysqlEnum("audience", ["all_families", "my_families", "staff_only"]).default("all_families"),
  /** Child ids tagged in the post, if any (the composer's "tag children" step). */
  taggedChildIds: json("taggedChildIds").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StoryPost = typeof storyPosts.$inferSelect;
export type InsertStoryPost = typeof storyPosts.$inferInsert;

export const storyPostLikes = mysqlTable("story_post_likes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => storyPosts.id),
  familyId: int("familyId").references(() => families.id),
  staffId: int("staffId").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StoryPostLike = typeof storyPostLikes.$inferSelect;
export type InsertStoryPostLike = typeof storyPostLikes.$inferInsert;

export const storyPostComments = mysqlTable("story_post_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => storyPosts.id),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  familyId: int("familyId").references(() => families.id),
  staffId: int("staffId").references(() => staff.id),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StoryPostComment = typeof storyPostComments.$inferSelect;
export type InsertStoryPostComment = typeof storyPostComments.$inferInsert;

/**
 * Per-user "archived" marker for a conversation — Communication.tsx's Inbox
 * "Archive" action previously only hid a row in local component state (no
 * server concept existed; `conversations.isActive` is unrelated — it marks
 * which thread is the live one for a family, not a per-viewer archive
 * status). Archiving is per-user, not global: one staff member archiving a
 * thread shouldn't hide it from a colleague. A new message in the
 * conversation clears any archive rows for it (see server/messaging.ts),
 * so an archived thread reappears once there's new activity.
 */
export const conversationArchives = mysqlTable("conversation_archives", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id),
  userId: int("userId").notNull().references(() => users.id),
  archivedAt: timestamp("archivedAt").defaultNow().notNull(),
}, (t) => ({
  convoUser: unique("conversation_archives_convo_user").on(t.conversationId, t.userId),
}));

export type ConversationArchive = typeof conversationArchives.$inferSelect;
export type InsertConversationArchive = typeof conversationArchives.$inferInsert;

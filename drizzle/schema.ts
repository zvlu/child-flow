import { date, decimal, int, json, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
 * Each organization represents a Head Start program or agency.
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
  type: mysqlEnum("type", ["allergy", "dietary", "disability", "special"]).notNull(),
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
  role: mysqlEnum("role", ["admin", "teacher", "assistant", "coordinator"]).default("teacher"),
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
  type: mysqlEnum("type", ["immunization", "dental", "physical", "vision", "hearing", "lead", "hemoglobin", "other"]).notNull(),
  status: mysqlEnum("status", ["up_to_date", "due_soon", "overdue", "exempt", "not_required"]).default("up_to_date"),
  recordDate: timestamp("recordDate").notNull(),
  expiryDate: timestamp("expiryDate"),
  provider: varchar("provider", { length: 255 }),
  notes: text("notes"),
  recordedBy: int("recordedBy").references(() => staff.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HealthRecord = typeof healthRecords.$inferSelect;
export type InsertHealthRecord = typeof healthRecords.$inferInsert;

/**
 * Family Services table for tracking home visits, contacts, and resource referrals.
 */
export const familyServices = mysqlTable("family_services", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  type: mysqlEnum("type", ["home_visit", "office_visit", "phone_call", "email", "referral", "other"]).notNull(),
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
 */
export const familyGoals = mysqlTable("family_goals", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id),
  title: varchar("title", { length: 255 }).notNull(),
  /** 0–100. */
  progress: int("progress").default(0).notNull(),
  status: mysqlEnum("status", ["active", "completed", "paused"]).default("active").notNull(),
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
 * PIR (Program Information Report) table for federal reporting data.
 */
export const pirData = mysqlTable("pir_data", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  year: varchar("year", { length: 9 }).notNull(), // e.g., "2024-2025"
  section: varchar("section", { length: 100 }).notNull(), // e.g., "Section A: Enrollment"
  questionId: varchar("questionId", { length: 50 }).notNull(),
  value: text("value").notNull(),
  updatedBy: int("updatedBy").references(() => staff.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PirData = typeof pirData.$inferSelect;
export type InsertPirData = typeof pirData.$inferInsert;

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
  childId: int("childId").notNull().references(() => children.id),
  organizationId: int("organizationId").notNull().references(() => organizations.id),
  documentType: mysqlEnum("documentType", ["birth_certificate", "immunization_record", "consent_form", "medical_record", "assessment", "other"]).notNull(),
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
  documentType: mysqlEnum("documentType", ["enrollment", "consent", "waiver", "health_form"]).notNull(),
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

import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Organizations table for multi-tenant support.
 * Each organization represents a Head Start program or agency.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  agencyId: varchar("agencyId", { length: 64 }).notNull().unique(),
  description: text("description"),
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
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Child = typeof children.$inferSelect;
export type InsertChild = typeof children.$inferInsert;

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

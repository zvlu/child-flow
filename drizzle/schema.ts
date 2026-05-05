import { date, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  familyId: int("familyId").references(() => families.id),
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

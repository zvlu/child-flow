/**
 * Query helpers for the full module surface of the web app:
 * classrooms, calendar, billing, meals, documents, staff ops, parent portal,
 * AI insights, bulk actions, notes, custom reports, and dashboard stats.
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  families, children, staff, classrooms, childClassroomAssignments, childFlags,
  attendance, healthRecords, studentNotes, calendarEvents, documents, familyServices,
  bulkActionLogs, aiInsights, invoices, payments, activityLogs,
  parentNotifications, digitalDocuments, mealPlans, mealItems, cacfpReports,
  lessonPlans, lessonActivities, InsertLessonPlan, InsertLessonActivity,
  portfolioEntries, InsertPortfolioEntry,
  subsidies, InsertSubsidy,
  deviceTokens, InsertDeviceToken, users,
  timeClock, certifications, customReports, educationRecords, pirData,
  pirQuestions, pirReports,
  familyContactAddresses,
  InsertFamily, InsertStaff, InsertStudentNote, InsertCalendarEvent,
  InsertDocument, InsertDigitalDocument, InsertInvoice, InsertPayment,
  InsertMealPlan, InsertMealItem, InsertCertification, InsertCustomReport,
  InsertEducationRecord, InsertAiInsight, InsertBulkActionLog,
  InsertActivityLog, InsertAttendance,
  customRoles, InsertCustomRole,
  enrollmentApplications, InsertEnrollmentApplication,
  inKindContributions, InsertInKindContribution,
  programRequests, InsertProgramRequest, organizations, InsertOrganization,
  disabilityServices,
  familyGoals, familyReferrals, familyHomeVisits, cfcrRecords, familyCaseNotes, attendancePlans,
} from "../drizzle/schema";
import { getDb } from "./db";
import { isEmptyPatch } from "./_core/patch";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ==================== FAMILIES ====================

export async function getOrganizationFamilies(organizationId: number) {
  const db = await requireDb();
  return db.select().from(families).where(eq(families.organizationId, organizationId));
}

export async function createFamily(data: InsertFamily) {
  const db = await requireDb();
  const [result] = await db.insert(families).values(data);
  return { id: result.insertId };
}

/** Update a family record. Caller must verify the family is in the user's org. */
export async function updateFamily(id: number, data: Partial<typeof families.$inferInsert>) {
  if (isEmptyPatch(data)) return { id };
  const db = await requireDb();
  await db.update(families).set(data).where(eq(families.id, id));
  return { id };
}

export async function getFamilyContacts(familyId: number) {
  const db = await requireDb();
  return db.select().from(familyContactAddresses).where(eq(familyContactAddresses.familyId, familyId));
}

// ==================== CHILDREN ====================

export async function updateChild(id: number, data: Partial<typeof children.$inferInsert>) {
  if (isEmptyPatch(data)) return { success: true };
  const db = await requireDb();
  await db.update(children).set(data).where(eq(children.id, id));
  return { success: true };
}

// ==================== CLASSROOMS ====================

export async function getOrganizationClassrooms(organizationId: number) {
  const db = await requireDb();
  const rooms = await db.select().from(classrooms).where(eq(classrooms.organizationId, organizationId));
  const assignments = await db
    .select({ classroomId: childClassroomAssignments.classroomId, count: sql<number>`count(*)` })
    .from(childClassroomAssignments)
    .where(eq(childClassroomAssignments.isActive, 1))
    .groupBy(childClassroomAssignments.classroomId);
  const staffRows = await db.select().from(staff).where(eq(staff.organizationId, organizationId));
  const staffName = (id: number | null) => {
    const s = staffRows.find(r => r.id === id);
    return s ? `${s.firstName} ${s.lastName}` : null;
  };
  const countByRoom = new Map(assignments.map(a => [a.classroomId, Number(a.count)]));
  return rooms.map(r => ({
    ...r,
    enrolledCount: countByRoom.get(r.id) ?? 0,
    teacherName: staffName(r.teacherId),
    assistantName: staffName(r.assistantId),
  }));
}

export async function getClassroomRoster(classroomId: number) {
  const db = await requireDb();
  return db
    .select({ child: children })
    .from(childClassroomAssignments)
    .innerJoin(children, eq(childClassroomAssignments.childId, children.id))
    .where(and(
      eq(childClassroomAssignments.classroomId, classroomId),
      eq(childClassroomAssignments.isActive, 1),
    ))
    .then(rows => rows.map(r => r.child));
}

/** Color-coded safety flags for all children in an org (allergy/dietary/…). */
export async function getChildFlags(organizationId: number) {
  const db = await requireDb();
  return db
    .select({
      id: childFlags.id,
      childId: childFlags.childId,
      type: childFlags.type,
      label: childFlags.label,
      detail: childFlags.detail,
    })
    .from(childFlags)
    .innerJoin(children, eq(childFlags.childId, children.id))
    .where(eq(children.organizationId, organizationId));
}

export async function addChildFlag(data: {
  childId: number;
  type: "allergy" | "dietary" | "disability" | "special";
  label: string;
  detail?: string | null;
}) {
  const db = await requireDb();
  await db.insert(childFlags).values({
    childId: data.childId,
    type: data.type,
    label: data.label,
    detail: data.detail ?? null,
  });
}

export async function removeChildFlag(id: number) {
  const db = await requireDb();
  await db.delete(childFlags).where(eq(childFlags.id, id));
}

/** The child a flag belongs to (for record-level tenant checks). */
export async function getChildIdForFlag(flagId: number): Promise<number | null> {
  const db = await requireDb();
  const [row] = await db.select({ childId: childFlags.childId }).from(childFlags).where(eq(childFlags.id, flagId)).limit(1);
  return row?.childId ?? null;
}

// Record-id → owning organization, for tenant checks on routes the org-scope
// middleware can't see (their input is a record id, not an org id). Only tables
// with a direct organizationId column are listed here.
const ORG_RECORD_TABLES = {
  family: families,
  classroom: classrooms,
  calendarEvent: calendarEvents,
  document: documents,
  digitalDocument: digitalDocuments,
  mealPlan: mealPlans,
  lessonPlan: lessonPlans,
  portfolioEntry: portfolioEntries,
  subsidy: subsidies,
  report: customReports,
  aiInsight: aiInsights,
  staff: staff,
  disabilityService: disabilityServices,
  familyGoal: familyGoals,
  familyReferral: familyReferrals,
  familyHomeVisit: familyHomeVisits,
  cfcrRecord: cfcrRecords,
  familyCaseNote: familyCaseNotes,
  attendancePlan: attendancePlans,
} as const;
export type OrgRecordKind = keyof typeof ORG_RECORD_TABLES;

export async function getRecordOrgId(kind: OrgRecordKind, id: number): Promise<number | null> {
  const db = await requireDb();
  const table = ORG_RECORD_TABLES[kind] as unknown as { organizationId: typeof families.organizationId; id: typeof families.id };
  const [row] = await db.select({ organizationId: table.organizationId }).from(table as any).where(eq(table.id, id)).limit(1);
  return row?.organizationId ?? null;
}

/**
 * Move a child to a classroom (or unassign with null). Ends any active
 * assignment first, so a child is only ever in one room at a time.
 */
export async function assignChildToClassroom(childId: number, classroomId: number | null) {
  const db = await requireDb();
  await db
    .update(childClassroomAssignments)
    .set({ isActive: 0, endDate: new Date() })
    .where(and(
      eq(childClassroomAssignments.childId, childId),
      eq(childClassroomAssignments.isActive, 1),
    ));
  if (classroomId != null) {
    await db.insert(childClassroomAssignments).values({ childId, classroomId });
  }
}

export async function getChildClassroomMap(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      childId: childClassroomAssignments.childId,
      classroomId: childClassroomAssignments.classroomId,
      classroomName: classrooms.name,
    })
    .from(childClassroomAssignments)
    .innerJoin(classrooms, eq(childClassroomAssignments.classroomId, classrooms.id))
    .where(and(eq(classrooms.organizationId, organizationId), eq(childClassroomAssignments.isActive, 1)));
  return rows;
}

// ==================== ATTENDANCE ====================

/** Upsert attendance records for a single day (replaces existing rows for those children). */
export async function saveAttendanceForDate(
  organizationId: number,
  date: Date,
  records: Array<Pick<InsertAttendance, "childId" | "status" | "checkInTime" | "checkOutTime" | "notes">>,
  recordedBy?: number | null,
) {
  const db = await requireDb();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  await db.delete(attendance).where(and(
    eq(attendance.organizationId, organizationId),
    gte(attendance.date, startOfDay),
    lte(attendance.date, endOfDay),
  ));
  if (records.length === 0) return { saved: 0 };
  await db.insert(attendance).values(records.map(r => ({
    ...r,
    organizationId,
    date: startOfDay,
    recordedBy: recordedBy ?? null,
  })));
  return { saved: records.length };
}

export async function getAttendanceRange(organizationId: number, start: Date, end: Date) {
  const db = await requireDb();
  return db.select().from(attendance).where(and(
    eq(attendance.organizationId, organizationId),
    gte(attendance.date, start),
    lte(attendance.date, end),
  ));
}

// ==================== STAFF ====================

export async function createStaff(data: InsertStaff) {
  const db = await requireDb();
  const [result] = await db.insert(staff).values(data);
  return { id: result.insertId };
}

export async function updateStaff(id: number, data: Partial<InsertStaff>) {
  if (isEmptyPatch(data)) return { success: true };
  const db = await requireDb();
  await db.update(staff).set(data).where(eq(staff.id, id));
  return { success: true };
}

// ==================== CUSTOM ROLES ====================

export async function getCustomRoles(organizationId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(customRoles)
    .where(eq(customRoles.organizationId, organizationId))
    .orderBy(customRoles.name);
}

export async function createCustomRole(data: InsertCustomRole) {
  const db = await requireDb();
  const [result] = await db.insert(customRoles).values(data);
  return { id: result.insertId };
}

export async function deleteCustomRole(id: number, organizationId: number) {
  const db = await requireDb();
  // Scope the delete to the org so one program can't remove another's roles.
  await db
    .delete(customRoles)
    .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, organizationId)));
  return { success: true };
}

// ==================== ENROLLMENT APPLICATIONS ====================

export async function getEnrollmentApplications(organizationId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(enrollmentApplications)
    .where(eq(enrollmentApplications.organizationId, organizationId))
    .orderBy(desc(enrollmentApplications.appliedDate));
}

export async function createEnrollmentApplication(data: InsertEnrollmentApplication) {
  const db = await requireDb();
  const [result] = await db.insert(enrollmentApplications).values(data);
  return { id: result.insertId };
}

export async function updateEnrollmentApplication(
  id: number,
  organizationId: number,
  data: Partial<Pick<InsertEnrollmentApplication, "status" | "priority" | "notes">>
) {
  if (isEmptyPatch(data)) return { success: true };
  const db = await requireDb();
  await db
    .update(enrollmentApplications)
    .set(data)
    .where(and(eq(enrollmentApplications.id, id), eq(enrollmentApplications.organizationId, organizationId)));
  return { success: true };
}

/**
 * Approve-and-enroll: turn an application into real family + child records and
 * mark it enrolled. Idempotent — if already enrolled, returns the existing
 * childId instead of creating duplicates.
 */
export async function enrollApplication(id: number, organizationId: number) {
  const db = await requireDb();
  const [app] = await db
    .select()
    .from(enrollmentApplications)
    .where(and(eq(enrollmentApplications.id, id), eq(enrollmentApplications.organizationId, organizationId)))
    .limit(1);
  if (!app) throw new Error("Application not found");
  if (app.enrolledChildId) return { childId: app.enrolledChildId, familyId: null, alreadyEnrolled: true };

  const [famResult] = await db.insert(families).values({
    organizationId,
    primaryContactName: app.parentName || `${app.childFirstName} ${app.childLastName} family`,
    primaryContactPhone: app.parentPhone ?? null,
    primaryContactEmail: app.parentEmail ?? null,
    address: app.address ?? null,
  });
  const familyId = Number(famResult.insertId);

  const [childResult] = await db.insert(children).values({
    organizationId,
    firstName: app.childFirstName,
    lastName: app.childLastName,
    dateOfBirth: app.dateOfBirth ?? null,
    gender: app.gender ?? null,
    familyId,
    status: "active",
  });
  const childId = Number(childResult.insertId);

  await db
    .update(enrollmentApplications)
    .set({ status: "enrolled", enrolledChildId: childId })
    .where(eq(enrollmentApplications.id, id));

  return { childId, familyId, alreadyEnrolled: false };
}

// ==================== IN-KIND CONTRIBUTIONS ====================

export async function getInKindContributions(organizationId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(inKindContributions)
    .where(eq(inKindContributions.organizationId, organizationId))
    .orderBy(desc(inKindContributions.date));
}

export async function createInKindContribution(data: InsertInKindContribution) {
  const db = await requireDb();
  const [result] = await db.insert(inKindContributions).values(data);
  return { id: result.insertId };
}

export async function deleteInKindContribution(id: number, organizationId: number) {
  const db = await requireDb();
  await db
    .delete(inKindContributions)
    .where(and(eq(inKindContributions.id, id), eq(inKindContributions.organizationId, organizationId)));
  return { success: true };
}

// ==================== PROGRAM REQUESTS (self-serve onboarding) ====================

export async function createProgramRequest(data: InsertProgramRequest) {
  const db = await requireDb();
  const [result] = await db.insert(programRequests).values(data);
  return { id: result.insertId };
}

export async function getProgramRequests() {
  const db = await requireDb();
  return db.select().from(programRequests).orderBy(desc(programRequests.createdAt));
}

export async function declineProgramRequest(id: number) {
  const db = await requireDb();
  await db.update(programRequests).set({ status: "declined" }).where(eq(programRequests.id, id));
  return { success: true };
}

/**
 * Approve a pending request: create the organization (active) and link it back.
 * Idempotent — if already approved, returns the existing org id.
 */
export async function approveProgramRequest(id: number, ownerId: number) {
  const db = await requireDb();
  const [req] = await db.select().from(programRequests).where(eq(programRequests.id, id)).limit(1);
  if (!req) throw new Error("Request not found");
  if (req.createdOrgId) return { orgId: req.createdOrgId, alreadyApproved: true };

  // Fall back to a generated agency id if the requester didn't supply one.
  const agencyId = (req.agencyId && req.agencyId.trim()) || `REQ-${req.id}`;
  const orgValues: InsertOrganization = {
    name: req.organizationName,
    agencyId,
    ownerId,
    subscriptionTier: "starter",
    maxChildren: 100,
    maxStaff: 20,
    isActive: 1,
  };
  const [orgResult] = await db.insert(organizations).values(orgValues);
  const orgId = Number(orgResult.insertId);
  await db.update(programRequests).set({ status: "approved", createdOrgId: orgId }).where(eq(programRequests.id, id));
  return { orgId, alreadyApproved: false };
}

// ==================== STUDENT NOTES ====================

export async function getStudentNotes(organizationId: number, childId?: number) {
  const db = await requireDb();
  const where = childId
    ? and(eq(studentNotes.organizationId, organizationId), eq(studentNotes.childId, childId))
    : eq(studentNotes.organizationId, organizationId);
  return db.select().from(studentNotes).where(where).orderBy(desc(studentNotes.isPinned), desc(studentNotes.createdAt));
}

export async function createStudentNote(data: InsertStudentNote) {
  const db = await requireDb();
  const [result] = await db.insert(studentNotes).values(data);
  return { id: result.insertId };
}

// ==================== CALENDAR ====================

export async function getCalendarEvents(organizationId: number) {
  const db = await requireDb();
  return db.select().from(calendarEvents).where(eq(calendarEvents.organizationId, organizationId)).orderBy(calendarEvents.startDate);
}

export async function createCalendarEvent(data: InsertCalendarEvent) {
  const db = await requireDb();
  const [result] = await db.insert(calendarEvents).values(data);
  return { id: result.insertId };
}

export async function updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>) {
  if (isEmptyPatch(data)) return { success: true };
  const db = await requireDb();
  await db.update(calendarEvents).set(data).where(eq(calendarEvents.id, id));
  return { success: true };
}

export async function deleteCalendarEvent(id: number) {
  const db = await requireDb();
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  return { success: true };
}

// ==================== DOCUMENTS ====================

export async function getDocuments(organizationId: number, childId?: number) {
  const db = await requireDb();
  const where = childId
    ? and(eq(documents.organizationId, organizationId), eq(documents.childId, childId))
    : eq(documents.organizationId, organizationId);
  return db.select().from(documents).where(where).orderBy(desc(documents.uploadedAt));
}

/** Same list with the assigned child's name joined in — backs the iOS REST mirror. */
export async function getDocumentsWithChildNames(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ doc: documents, childFirst: children.firstName, childLast: children.lastName })
    .from(documents)
    .leftJoin(children, eq(documents.childId, children.id))
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.uploadedAt));
  return rows.map(r => ({
    ...r.doc,
    childName: r.childFirst != null ? `${r.childFirst} ${r.childLast}` : null,
  }));
}

export async function createDocument(data: InsertDocument) {
  const db = await requireDb();
  const [result] = await db.insert(documents).values(data);
  return { id: result.insertId };
}

/** File an unassigned (or re-file an assigned) document to a child. */
export async function assignDocumentToChild(id: number, organizationId: number, childId: number) {
  const db = await requireDb();
  await db.update(documents).set({ childId }).where(and(eq(documents.id, id), eq(documents.organizationId, organizationId)));
  return { success: true };
}

export async function deleteDocument(id: number) {
  const db = await requireDb();
  await db.delete(documents).where(eq(documents.id, id));
  return { success: true };
}

// ==================== DIGITAL DOCUMENTS (E-SIGN) ====================

export async function getDigitalDocuments(organizationId: number) {
  const db = await requireDb();
  return db.select().from(digitalDocuments).where(eq(digitalDocuments.organizationId, organizationId)).orderBy(desc(digitalDocuments.createdAt));
}

/** Same list with the family's display name joined in — backs the iOS REST mirror. */
export async function getDigitalDocumentsWithFamily(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ doc: digitalDocuments, familyName: families.primaryContactName })
    .from(digitalDocuments)
    .innerJoin(families, eq(digitalDocuments.familyId, families.id))
    .where(eq(digitalDocuments.organizationId, organizationId))
    .orderBy(desc(digitalDocuments.createdAt));
  return rows.map(r => ({ ...r.doc, familyName: r.familyName }));
}

export async function getDigitalDocument(id: number) {
  const db = await requireDb();
  const [row] = await db.select().from(digitalDocuments).where(eq(digitalDocuments.id, id)).limit(1);
  return row;
}

export async function createDigitalDocument(data: InsertDigitalDocument) {
  const db = await requireDb();
  const [result] = await db.insert(digitalDocuments).values(data);
  return { id: result.insertId };
}

export async function signDigitalDocument(id: number, signedBy: string) {
  const db = await requireDb();
  await db.update(digitalDocuments)
    .set({ signedBy, signedAt: new Date(), status: "signed" })
    .where(eq(digitalDocuments.id, id));
  return { success: true };
}

// ==================== BILLING ====================

export async function getInvoices(organizationId: number) {
  const db = await requireDb();
  return db
    .select({ invoice: invoices, familyName: families.primaryContactName })
    .from(invoices)
    .innerJoin(families, eq(invoices.familyId, families.id))
    .where(eq(invoices.organizationId, organizationId))
    .orderBy(desc(invoices.createdAt))
    .then(rows => rows.map(r => ({ ...r.invoice, familyName: r.familyName })));
}

export async function createInvoice(data: InsertInvoice) {
  const db = await requireDb();
  const [result] = await db.insert(invoices).values(data);
  return { id: result.insertId };
}

export async function getPayments(organizationId: number) {
  const db = await requireDb();
  return db.select().from(payments).where(eq(payments.organizationId, organizationId)).orderBy(desc(payments.transactionDate));
}

export async function recordPayment(data: InsertPayment) {
  const db = await requireDb();
  const [result] = await db.insert(payments).values({ ...data, status: "completed" });
  await db.update(invoices).set({ status: "paid", paidAt: new Date() }).where(eq(invoices.id, data.invoiceId));
  return { id: result.insertId };
}

// ==================== MEAL PLANNING ====================

export async function getMealPlans(organizationId: number) {
  const db = await requireDb();
  const plans = await db
    .select({ plan: mealPlans, classroomName: classrooms.name })
    .from(mealPlans)
    .innerJoin(classrooms, eq(mealPlans.classroomId, classrooms.id))
    .where(eq(mealPlans.organizationId, organizationId))
    .orderBy(desc(mealPlans.weekStartDate));
  return plans.map(r => ({ ...r.plan, classroomName: r.classroomName }));
}

export async function getMealItems(mealPlanId: number) {
  const db = await requireDb();
  return db.select().from(mealItems).where(eq(mealItems.mealPlanId, mealPlanId));
}

export async function createMealPlan(data: InsertMealPlan, items: Omit<InsertMealItem, "mealPlanId">[]) {
  const db = await requireDb();
  const [result] = await db.insert(mealPlans).values(data);
  const planId = result.insertId;
  if (items.length > 0) {
    await db.insert(mealItems).values(items.map(i => ({ ...i, mealPlanId: planId })));
  }
  return { id: planId };
}

export async function updateMealPlanStatus(id: number, status: "draft" | "approved" | "served") {
  const db = await requireDb();
  await db.update(mealPlans).set({ status }).where(eq(mealPlans.id, id));
  return { success: true };
}

// ==================== LESSON PLANNING ====================

export async function getLessonPlans(organizationId: number) {
  const db = await requireDb();
  const plans = await db
    .select({ plan: lessonPlans, classroomName: classrooms.name })
    .from(lessonPlans)
    .innerJoin(classrooms, eq(lessonPlans.classroomId, classrooms.id))
    .where(eq(lessonPlans.organizationId, organizationId))
    .orderBy(desc(lessonPlans.weekStartDate));
  return plans.map(r => ({ ...r.plan, classroomName: r.classroomName }));
}

/** One lesson plan with its classroom name and all activities. */
export async function getLessonPlan(id: number) {
  const db = await requireDb();
  const [row] = await db
    .select({ plan: lessonPlans, classroomName: classrooms.name })
    .from(lessonPlans)
    .innerJoin(classrooms, eq(lessonPlans.classroomId, classrooms.id))
    .where(eq(lessonPlans.id, id));
  if (!row) return null;
  const activities = await db.select().from(lessonActivities).where(eq(lessonActivities.lessonPlanId, id)).orderBy(lessonActivities.id);
  return { ...row.plan, classroomName: row.classroomName, activities };
}

export async function createLessonPlan(data: InsertLessonPlan) {
  const db = await requireDb();
  const [result] = await db.insert(lessonPlans).values(data);
  return { id: result.insertId };
}

export async function updateLessonPlan(id: number, data: Partial<typeof lessonPlans.$inferInsert>) {
  if (isEmptyPatch(data)) return { id };
  const db = await requireDb();
  await db.update(lessonPlans).set(data).where(eq(lessonPlans.id, id));
  return { id };
}

export async function addLessonActivity(data: InsertLessonActivity) {
  const db = await requireDb();
  const [result] = await db.insert(lessonActivities).values(data);
  return { id: result.insertId };
}

export async function deleteLessonActivity(id: number) {
  const db = await requireDb();
  await db.delete(lessonActivities).where(eq(lessonActivities.id, id));
  return { success: true };
}

/** The org that owns a lesson plan — for tenant checks on activity mutations. */
export async function getLessonPlanOrg(lessonPlanId: number): Promise<number | null> {
  const db = await requireDb();
  const [row] = await db.select({ orgId: lessonPlans.organizationId }).from(lessonPlans).where(eq(lessonPlans.id, lessonPlanId));
  return row?.orgId ?? null;
}

// ==================== CHILD PORTFOLIOS ====================

/** A child's developmental portfolio — observations newest first, with author. */
export async function getPortfolioEntries(childId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ entry: portfolioEntries, staffFirst: staff.firstName, staffLast: staff.lastName })
    .from(portfolioEntries)
    .leftJoin(staff, eq(portfolioEntries.createdBy, staff.id))
    .where(eq(portfolioEntries.childId, childId))
    .orderBy(desc(portfolioEntries.observedAt), desc(portfolioEntries.createdAt));
  return rows.map(r => ({
    ...r.entry,
    authorName: r.staffFirst ? `${r.staffFirst} ${r.staffLast}` : null,
  }));
}

export async function createPortfolioEntry(data: InsertPortfolioEntry) {
  const db = await requireDb();
  const [result] = await db.insert(portfolioEntries).values(data);
  return { id: result.insertId };
}

export async function deletePortfolioEntry(id: number) {
  const db = await requireDb();
  await db.delete(portfolioEntries).where(eq(portfolioEntries.id, id));
  return { success: true };
}

// ==================== SUBSIDY TRACKING ====================

/** All subsidies for an org, with the family's primary contact name. */
export async function getSubsidies(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ subsidy: subsidies, familyName: families.primaryContactName })
    .from(subsidies)
    .innerJoin(families, eq(subsidies.familyId, families.id))
    .where(eq(subsidies.organizationId, organizationId))
    .orderBy(desc(subsidies.createdAt));
  return rows.map(r => ({ ...r.subsidy, familyName: r.familyName }));
}

export async function createSubsidy(data: InsertSubsidy) {
  const db = await requireDb();
  const [result] = await db.insert(subsidies).values(data);
  return { id: result.insertId };
}

export async function updateSubsidy(id: number, data: Partial<typeof subsidies.$inferInsert>) {
  if (isEmptyPatch(data)) return { id };
  const db = await requireDb();
  await db.update(subsidies).set(data).where(eq(subsidies.id, id));
  return { id };
}

export async function deleteSubsidy(id: number) {
  const db = await requireDb();
  await db.delete(subsidies).where(eq(subsidies.id, id));
  return { success: true };
}

// ==================== PUSH / DEVICE TOKENS ====================

/** Register (or re-point) a device push token to a user. Idempotent by token. */
export async function registerDeviceToken(userId: number, token: string, platform: "ios" | "android" | "web") {
  const db = await requireDb();
  const existing = await db.select().from(deviceTokens).where(eq(deviceTokens.token, token)).limit(1);
  if (existing.length > 0) {
    await db.update(deviceTokens).set({ userId, platform }).where(eq(deviceTokens.token, token));
    return { id: existing[0].id };
  }
  const [result] = await db.insert(deviceTokens).values({ userId, token, platform });
  return { id: result.insertId };
}

export async function getDeviceTokensForUser(userId: number): Promise<string[]> {
  const db = await requireDb();
  const rows = await db.select({ token: deviceTokens.token }).from(deviceTokens).where(eq(deviceTokens.userId, userId));
  return rows.map(r => r.token);
}

/** All device tokens for the parent user(s) attached to a family. */
export async function getDeviceTokensForFamily(familyId: number): Promise<string[]> {
  const db = await requireDb();
  const rows = await db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .innerJoin(users, eq(deviceTokens.userId, users.id))
    .where(eq(users.familyId, familyId));
  return rows.map(r => r.token);
}

/** Remove a token (e.g. APNs reported it invalid). */
export async function removeDeviceToken(token: string) {
  const db = await requireDb();
  await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
}

/** The family + first name for a child — used to address push notifications. */
export async function getChildForNotify(childId: number): Promise<{ familyId: number | null; firstName: string } | null> {
  const db = await requireDb();
  const [row] = await db.select({ familyId: children.familyId, firstName: children.firstName }).from(children).where(eq(children.id, childId));
  return row ? { familyId: row.familyId ?? null, firstName: row.firstName } : null;
}

export async function getCacfpReports(organizationId: number) {
  const db = await requireDb();
  return db.select().from(cacfpReports).where(eq(cacfpReports.organizationId, organizationId)).orderBy(desc(cacfpReports.reportMonth));
}

// ==================== STAFF OPERATIONS ====================

export async function getTimeClockEntries(organizationId: number, sinceDays = 14) {
  const db = await requireDb();
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const rows = await db
    .select({ entry: timeClock, firstName: staff.firstName, lastName: staff.lastName, position: staff.position })
    .from(timeClock)
    .innerJoin(staff, eq(timeClock.staffId, staff.id))
    .where(and(eq(staff.organizationId, organizationId), gte(timeClock.clockInTime, since)))
    .orderBy(desc(timeClock.clockInTime));
  return rows.map(r => ({ ...r.entry, staffName: `${r.firstName} ${r.lastName}`, position: r.position }));
}

export async function clockIn(staffId: number) {
  const db = await requireDb();
  const now = new Date();
  const [result] = await db.insert(timeClock).values({
    staffId,
    clockInTime: now,
    date: now,
  });
  return { id: result.insertId };
}

export async function clockOut(entryId: number) {
  const db = await requireDb();
  const [entry] = await db.select().from(timeClock).where(eq(timeClock.id, entryId));
  if (!entry) throw new Error("Time clock entry not found");
  const now = new Date();
  const hours = (now.getTime() - new Date(entry.clockInTime).getTime()) / 3600000;
  await db.update(timeClock)
    .set({ clockOutTime: now, hoursWorked: hours.toFixed(2) })
    .where(eq(timeClock.id, entryId));
  return { success: true, hoursWorked: hours.toFixed(2) };
}

/** Org that owns a time-clock entry (via its staff member), for tenant checks. */
export async function getTimeClockEntryOrgId(entryId: number): Promise<number | null> {
  const db = await requireDb();
  const [row] = await db
    .select({ organizationId: staff.organizationId })
    .from(timeClock)
    .innerJoin(staff, eq(timeClock.staffId, staff.id))
    .where(eq(timeClock.id, entryId))
    .limit(1);
  return row?.organizationId ?? null;
}

const CERT_EXPIRING_SOON_DAYS = 60;

/** Live status from expiryDate — never trust the stored `status` column, which is only set at creation and drifts stale as the date approaches. */
export function certificationStatus(expiryDate: Date | string, now: Date = new Date()): "expired" | "expiring_soon" | "active" {
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= CERT_EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

export async function getCertifications(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ cert: certifications, firstName: staff.firstName, lastName: staff.lastName })
    .from(certifications)
    .innerJoin(staff, eq(certifications.staffId, staff.id))
    .where(eq(staff.organizationId, organizationId))
    .orderBy(certifications.expiryDate);
  return rows.map(r => ({ ...r.cert, status: certificationStatus(r.cert.expiryDate), staffName: `${r.firstName} ${r.lastName}` }));
}

/** Counts behind the credential-expiry summary card / Action Queue. */
export async function getCertificationExpirySummary(organizationId: number) {
  const certs = await getCertifications(organizationId);
  return {
    expired: certs.filter(c => c.status === "expired").length,
    expiringSoon: certs.filter(c => c.status === "expiring_soon").length,
    active: certs.filter(c => c.status === "active").length,
    total: certs.length,
  };
}

export async function createCertification(data: InsertCertification) {
  const db = await requireDb();
  const [result] = await db.insert(certifications).values(data);
  return { id: result.insertId };
}

// ==================== AI INSIGHTS ====================

export async function getAiInsights(organizationId: number, includeDismissed = false) {
  const db = await requireDb();
  const rows = await db
    .select({ insight: aiInsights, firstName: children.firstName, lastName: children.lastName })
    .from(aiInsights)
    .innerJoin(children, eq(aiInsights.childId, children.id))
    .where(eq(aiInsights.organizationId, organizationId))
    .orderBy(desc(aiInsights.generatedAt));
  return rows
    .map(r => ({ ...r.insight, childName: `${r.firstName} ${r.lastName}` }))
    .filter(i => includeDismissed || !i.dismissedAt);
}

export async function dismissAiInsight(id: number) {
  const db = await requireDb();
  await db.update(aiInsights).set({ dismissedAt: new Date() }).where(eq(aiInsights.id, id));
  return { success: true };
}

export async function createAiInsight(data: InsertAiInsight) {
  const db = await requireDb();
  const [result] = await db.insert(aiInsights).values(data);
  return { id: result.insertId };
}

// ==================== BULK ACTIONS ====================

export async function getBulkActionLogs(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ log: bulkActionLogs, classroomName: classrooms.name, firstName: staff.firstName, lastName: staff.lastName })
    .from(bulkActionLogs)
    .innerJoin(classrooms, eq(bulkActionLogs.classroomId, classrooms.id))
    .innerJoin(staff, eq(bulkActionLogs.performedBy, staff.id))
    .where(eq(bulkActionLogs.organizationId, organizationId))
    .orderBy(desc(bulkActionLogs.actionDate));
  return rows.map(r => ({ ...r.log, classroomName: r.classroomName, performedByName: `${r.firstName} ${r.lastName}` }));
}

export async function createBulkActionLog(data: InsertBulkActionLog) {
  const db = await requireDb();
  const [result] = await db.insert(bulkActionLogs).values({ ...data, status: "completed", completedAt: new Date() });
  return { id: result.insertId };
}

// ==================== PARENT PORTAL ====================

export async function getActivityLogs(organizationId: number, childId?: number) {
  const db = await requireDb();
  const rows = await db
    .select({ log: activityLogs, childFirst: children.firstName, childLast: children.lastName, staffFirst: staff.firstName, staffLast: staff.lastName })
    .from(activityLogs)
    .innerJoin(children, eq(activityLogs.childId, children.id))
    .innerJoin(staff, eq(activityLogs.staffId, staff.id))
    .where(childId
      ? and(eq(children.organizationId, organizationId), eq(activityLogs.childId, childId))
      : eq(children.organizationId, organizationId))
    .orderBy(desc(activityLogs.timestamp))
    .limit(250);
  return rows.map(r => ({
    ...r.log,
    childName: `${r.childFirst} ${r.childLast}`,
    staffName: `${r.staffFirst} ${r.staffLast}`,
  }));
}

export async function createActivityLog(data: InsertActivityLog) {
  const db = await requireDb();
  const [result] = await db.insert(activityLogs).values(data);
  return { id: result.insertId };
}

/** Activity feed for one family — every moment for the family's children, newest first. */
export async function getFamilyActivityLogs(familyId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ log: activityLogs, childFirst: children.firstName, childLast: children.lastName, staffFirst: staff.firstName, staffLast: staff.lastName })
    .from(activityLogs)
    .innerJoin(children, eq(activityLogs.childId, children.id))
    .innerJoin(staff, eq(activityLogs.staffId, staff.id))
    .where(eq(children.familyId, familyId))
    .orderBy(desc(activityLogs.timestamp))
    .limit(250);
  return rows.map(r => ({
    ...r.log,
    childName: `${r.childFirst} ${r.childLast}`,
    staffName: `${r.staffFirst} ${r.staffLast}`,
  }));
}

/**
 * The staff.id to attribute an action to: the staff row linked to this user if
 * there is one, else any staff in their org (single-tenant demo fallback).
 */
export async function resolveStaffId(organizationId: number | null, userId: number): Promise<number | null> {
  const db = await requireDb();
  const byUser = await db.select({ id: staff.id }).from(staff).where(eq(staff.userId, userId)).limit(1);
  if (byUser.length) return byUser[0].id;
  const rows = organizationId != null
    ? await db.select({ id: staff.id }).from(staff).where(eq(staff.organizationId, organizationId)).limit(1)
    : await db.select({ id: staff.id }).from(staff).limit(1);
  return rows[0]?.id ?? null;
}

// ==================== STAFF ACTIVITY REPORTS ====================

/** Family-contact types tracked for advocate workload, in display order. */
export const FAMILY_CONTACT_TYPES = [
  "home_visit", "office_visit", "phone_call", "email",
  "referral", "coordinated_services", "monthly_contact", "other",
] as const;

export type StaffActivityRow = {
  staffId: number | null;
  name: string;
  position: string | null;
  total: number;
  byType: Record<string, number>;
  lastActivity: Date | null;
};

/**
 * Per-staff workload over a date range, built from logged family-service
 * contacts (home visits, monthly/routine contacts, coordinated-service
 * discussions, referrals, …). Powers two views from one call:
 *   - supervisor view — every active staff member's counts side by side
 *     (including those with zero contacts in the window), and
 *   - a single advocate's contact log, when `staffId` is supplied (`detail`).
 */
export async function getStaffActivityReport(
  organizationId: number,
  opts: { start: Date; end: Date; staffId?: number | null },
) {
  const db = await requireDb();

  const rows = await db
    .select({
      id: familyServices.id,
      type: familyServices.type,
      serviceDate: familyServices.serviceDate,
      description: familyServices.description,
      outcome: familyServices.outcome,
      followUpRequired: familyServices.followUpRequired,
      followUpDate: familyServices.followUpDate,
      familyId: familyServices.familyId,
      familyName: families.primaryContactName,
      staffId: familyServices.recordedBy,
      firstName: staff.firstName,
      lastName: staff.lastName,
      position: staff.position,
    })
    .from(familyServices)
    .leftJoin(staff, eq(familyServices.recordedBy, staff.id))
    .leftJoin(families, eq(familyServices.familyId, families.id))
    .where(and(
      eq(familyServices.organizationId, organizationId),
      gte(familyServices.serviceDate, opts.start),
      lte(familyServices.serviceDate, opts.end),
    ))
    .orderBy(desc(familyServices.serviceDate))
    .limit(5000);

  const emptyCounts = () =>
    Object.fromEntries(FAMILY_CONTACT_TYPES.map((t) => [t, 0])) as Record<string, number>;

  // Seed a bucket for every active staff member so a supervisor sees who has
  // *zero* contacts in the window, not only who's been active.
  const activeStaff = await db
    .select({ id: staff.id, firstName: staff.firstName, lastName: staff.lastName, position: staff.position })
    .from(staff)
    .where(and(eq(staff.organizationId, organizationId), eq(staff.isActive, 1)));

  const buckets = new Map<number, StaffActivityRow>();
  const UNASSIGNED = -1;
  for (const s of activeStaff) {
    buckets.set(s.id, {
      staffId: s.id,
      name: `${s.firstName} ${s.lastName}`.trim() || `Staff #${s.id}`,
      position: s.position,
      total: 0,
      byType: emptyCounts(),
      lastActivity: null,
    });
  }

  const totals = { total: 0, byType: emptyCounts() };

  for (const r of rows) {
    const key = r.staffId ?? UNASSIGNED;
    let b = buckets.get(key);
    if (!b) {
      b = {
        staffId: r.staffId ?? null,
        name: r.staffId
          ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || `Staff #${r.staffId}`
          : "Unassigned",
        position: r.position ?? null,
        total: 0,
        byType: emptyCounts(),
        lastActivity: null,
      };
      buckets.set(key, b);
    }
    const type = (r.type as string) in b.byType ? (r.type as string) : "other";
    b.byType[type] += 1;
    b.total += 1;
    totals.byType[type] += 1;
    totals.total += 1;
    const d = r.serviceDate ? new Date(r.serviceDate) : null;
    if (d && (!b.lastActivity || d > b.lastActivity)) b.lastActivity = d;
  }

  // Keep every real staff member (so empty advocates surface); drop the
  // synthetic "Unassigned" bucket unless it actually has contacts.
  const staffSummary = Array.from(buckets.values())
    .filter((b) => b.total > 0 || b.staffId != null)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const detail = opts.staffId
    ? rows
        .filter((r) => r.staffId === opts.staffId)
        .map((r) => ({
          id: r.id,
          type: r.type as string,
          serviceDate: r.serviceDate,
          description: r.description,
          outcome: r.outcome,
          followUpRequired: Number(r.followUpRequired) === 1,
          followUpDate: r.followUpDate,
          familyId: r.familyId,
          familyName: r.familyName ?? `Family #${r.familyId}`,
        }))
    : [];

  return {
    range: { start: opts.start, end: opts.end },
    types: FAMILY_CONTACT_TYPES as readonly string[],
    staff: staffSummary,
    totals,
    detail,
  };
}

export async function getParentNotifications(familyId: number) {
  const db = await requireDb();
  return db.select().from(parentNotifications).where(eq(parentNotifications.familyId, familyId)).orderBy(desc(parentNotifications.createdAt));
}

/** Family a parent-notification belongs to, for tenant checks. */
export async function getNotificationFamilyId(id: number): Promise<number | null> {
  const db = await requireDb();
  const [row] = await db.select({ familyId: parentNotifications.familyId }).from(parentNotifications).where(eq(parentNotifications.id, id)).limit(1);
  return row?.familyId ?? null;
}

export async function markNotificationRead(id: number) {
  const db = await requireDb();
  await db.update(parentNotifications).set({ isRead: 1 }).where(eq(parentNotifications.id, id));
  return { success: true };
}

// ==================== EDUCATION & PIR ====================

export async function createEducationRecord(data: InsertEducationRecord) {
  const db = await requireDb();
  const [result] = await db.insert(educationRecords).values(data);
  return { id: result.insertId };
}

export async function upsertPirValue(organizationId: number, year: string, section: string, questionId: string, value: string, updatedBy?: number | null) {
  const db = await requireDb();
  // Every value belongs to the (org, year) report envelope; create it lazily.
  const report = await ensurePirReport(organizationId, year);
  // Federal reports are immutable once submitted — enforce at the data layer
  // so direct API calls can't bypass the UI's disabled state. Reopen first.
  if (report.status !== "draft") {
    throw new Error(`PIR ${year} is ${report.status} and locked. Reopen the report to edit values.`);
  }
  const existing = await db.select().from(pirData).where(and(
    eq(pirData.organizationId, organizationId),
    eq(pirData.year, year),
    eq(pirData.questionId, questionId),
  ));
  if (existing.length > 0) {
    await db.update(pirData).set({ value, updatedBy: updatedBy ?? null, reportId: report.id }).where(eq(pirData.id, existing[0].id));
    return { id: existing[0].id };
  }
  const [result] = await db.insert(pirData).values({ organizationId, year, section, questionId, value, reportId: report.id, updatedBy: updatedBy ?? null });
  return { id: result.insertId };
}

/** PIR question catalog — global reference data (see scripts/seed-pir-questions.ts). */
export async function getPirQuestions() {
  const db = await requireDb();
  return db.select().from(pirQuestions).where(eq(pirQuestions.isActive, 1)).orderBy(pirQuestions.sortOrder);
}

/** Get (or lazily create) the report envelope for an org + year. */
export async function ensurePirReport(organizationId: number, year: string) {
  const db = await requireDb();
  const find = () => db.select().from(pirReports).where(and(
    eq(pirReports.organizationId, organizationId),
    eq(pirReports.year, year),
  ));
  const existing = await find();
  if (existing.length > 0) return existing[0];
  await db.insert(pirReports).values({ organizationId, year });
  const [created] = await find();
  return created;
}

/**
 * Full PIR report for an org + year: the envelope, the question catalog, and
 * each question's saved value (null when unanswered). The envelope is created
 * on demand so the editor always has something to attach values to.
 */
export async function getPirReport(organizationId: number, year: string) {
  const db = await requireDb();
  const report = await ensurePirReport(organizationId, year);
  const [questions, values] = await Promise.all([
    db.select().from(pirQuestions).where(eq(pirQuestions.isActive, 1)).orderBy(pirQuestions.sortOrder),
    db.select().from(pirData).where(and(
      eq(pirData.organizationId, organizationId),
      eq(pirData.year, year),
    )),
  ]);
  const valueByCode = new Map(values.map(v => [v.questionId, v.value]));
  const isAnswered = (v: string | null | undefined) => v !== undefined && v !== null && v !== "";
  const answered = questions.filter(q => isAnswered(valueByCode.get(q.code))).length;
  return {
    report,
    year,
    totalQuestions: questions.length,
    answeredQuestions: answered,
    questions: questions.map(q => ({ ...q, value: valueByCode.get(q.code) ?? null })),
  };
}

/** Mark a report submitted. Creates the envelope first if needed. */
export async function submitPirReport(organizationId: number, year: string, submittedBy?: number | null) {
  const db = await requireDb();
  const report = await ensurePirReport(organizationId, year);
  await db.update(pirReports)
    .set({ status: "submitted", submittedBy: submittedBy ?? null, submittedAt: new Date() })
    .where(eq(pirReports.id, report.id));
  return { id: report.id, status: "submitted" as const };
}

/** Re-open a submitted report for further edits. */
export async function reopenPirReport(organizationId: number, year: string) {
  const db = await requireDb();
  const report = await ensurePirReport(organizationId, year);
  await db.update(pirReports)
    .set({ status: "draft", submittedAt: null })
    .where(eq(pirReports.id, report.id));
  return { id: report.id, status: "draft" as const };
}

/**
 * All PIR reports for an org (newest year first), each with its completion count
 * (catalog questions answered with a non-empty value). Powers the inline,
 * view-in-place report history — no per-report round trips for the summary.
 */
export async function listPirReports(organizationId: number) {
  const db = await requireDb();
  const [reports, questions, values] = await Promise.all([
    db.select().from(pirReports).where(eq(pirReports.organizationId, organizationId)),
    db.select({ code: pirQuestions.code }).from(pirQuestions).where(eq(pirQuestions.isActive, 1)),
    db.select({ year: pirData.year, questionId: pirData.questionId, value: pirData.value })
      .from(pirData).where(eq(pirData.organizationId, organizationId)),
  ]);
  const codes = new Set(questions.map(q => q.code));
  const total = codes.size;
  const answeredByYear = new Map<string, Set<string>>();
  for (const v of values) {
    if (!codes.has(v.questionId) || v.value === "" || v.value == null) continue;
    if (!answeredByYear.has(v.year)) answeredByYear.set(v.year, new Set());
    answeredByYear.get(v.year)!.add(v.questionId);
  }
  return reports
    .map(r => ({ ...r, total, answered: answeredByYear.get(r.year)?.size ?? 0 }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

// ==================== CUSTOM REPORTS ====================

export async function getCustomReports(organizationId: number) {
  const db = await requireDb();
  return db.select().from(customReports).where(eq(customReports.organizationId, organizationId)).orderBy(desc(customReports.createdAt));
}

export async function createCustomReport(data: InsertCustomReport) {
  const db = await requireDb();
  const [result] = await db.insert(customReports).values(data);
  return { id: result.insertId };
}

/** Run a saved report against live data and return row data by report type. */
export async function runCustomReport(reportId: number) {
  const db = await requireDb();
  const [report] = await db.select().from(customReports).where(eq(customReports.id, reportId));
  if (!report) throw new Error("Report not found");
  const orgId = report.organizationId;
  let rows: Record<string, unknown>[] = [];

  if (report.reportType === "attendance") {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const [kids, records] = await Promise.all([
      db.select().from(children).where(eq(children.organizationId, orgId)),
      db.select().from(attendance).where(and(eq(attendance.organizationId, orgId), gte(attendance.date, start))),
    ]);
    rows = kids.map(c => {
      const recs = records.filter(r => r.childId === c.id);
      const present = recs.filter(r => r.status === "present" || r.status === "half_day").length;
      const absent = recs.filter(r => r.status === "absent" || r.status === "excused").length;
      return {
        child: `${c.firstName} ${c.lastName}`,
        daysPresent: present,
        daysAbsent: absent,
        rate: recs.length ? `${Math.round((present / recs.length) * 100)}%` : "—",
      };
    });
  } else if (report.reportType === "health") {
    const [kids, records] = await Promise.all([
      db.select().from(children).where(eq(children.organizationId, orgId)),
      db.select().from(healthRecords).where(eq(healthRecords.organizationId, orgId)),
    ]);
    const nameById = new Map(kids.map(c => [c.id, `${c.firstName} ${c.lastName}`]));
    rows = records
      .filter(r => r.status === "overdue" || r.status === "due_soon")
      .map(r => ({
        child: nameById.get(r.childId) ?? `Child #${r.childId}`,
        screening: r.type,
        status: r.status,
        expiry: r.expiryDate ? new Date(r.expiryDate).toISOString().slice(0, 10) : "—",
      }));
  } else if (report.reportType === "enrollment") {
    const rooms = await getOrganizationClassrooms(orgId);
    rows = rooms.map(r => ({
      classroom: r.name,
      enrolled: r.enrolledCount,
      capacity: r.capacity,
      utilization: r.capacity ? `${Math.round((r.enrolledCount / r.capacity) * 100)}%` : "—",
    }));
  } else if (report.reportType === "financial") {
    const invs = await getInvoices(orgId);
    rows = invs.map(i => ({
      invoice: i.invoiceNumber,
      family: i.familyName,
      amount: i.amount,
      status: i.status,
      dueDate: i.dueDate,
    }));
  } else if (report.reportType === "compliance") {
    const pir = await db.select().from(pirData).where(eq(pirData.organizationId, orgId));
    rows = pir.map(p => ({ section: p.section, question: p.questionId, value: p.value, year: p.year }));
  }

  await db.update(customReports).set({ lastRunAt: new Date() }).where(eq(customReports.id, reportId));
  return { reportName: report.reportName, reportType: report.reportType, columns: report.columns, rows, generatedAt: new Date() };
}

// ==================== DASHBOARD ====================

export async function getDashboardStats(organizationId: number) {
  const db = await requireDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const in14 = new Date();
  in14.setDate(in14.getDate() + 14);

  const [kids, staffRows, todayAttendance, health, events, pendingDocs, openInsights] = await Promise.all([
    db.select().from(children).where(eq(children.organizationId, organizationId)),
    db.select().from(staff).where(and(eq(staff.organizationId, organizationId), eq(staff.isActive, 1))),
    db.select().from(attendance).where(and(
      eq(attendance.organizationId, organizationId),
      gte(attendance.date, startOfToday),
      lte(attendance.date, endOfToday),
    )),
    db.select().from(healthRecords).where(eq(healthRecords.organizationId, organizationId)),
    db.select().from(calendarEvents).where(and(
      eq(calendarEvents.organizationId, organizationId),
      gte(calendarEvents.startDate, startOfToday),
      lte(calendarEvents.startDate, in14),
    )).orderBy(calendarEvents.startDate),
    db.select().from(digitalDocuments).where(and(
      eq(digitalDocuments.organizationId, organizationId),
      eq(digitalDocuments.status, "pending"),
    )),
    db.select().from(aiInsights).where(eq(aiInsights.organizationId, organizationId)),
  ]);

  const activeChildren = kids.filter(c => c.status === "active");
  const present = todayAttendance.filter(a => a.status === "present" || a.status === "half_day").length;
  const overdueHealth = health.filter(h => h.status === "overdue").length;
  const dueSoonHealth = health.filter(h => h.status === "due_soon").length;
  const compliantHealth = health.filter(h => h.status === "up_to_date").length;

  return {
    totalChildren: kids.length,
    activeChildren: activeChildren.length,
    staffCount: staffRows.length,
    attendanceToday: {
      present,
      recorded: todayAttendance.length,
      rate: todayAttendance.length ? Math.round((present / todayAttendance.length) * 100) : null,
    },
    health: {
      overdue: overdueHealth,
      dueSoon: dueSoonHealth,
      complianceRate: health.length ? Math.round((compliantHealth / health.length) * 100) : null,
    },
    pendingSignatures: pendingDocs.length,
    openActionItems: openInsights.filter(i => !i.dismissedAt && i.actionRequired === 1).length,
    upcomingEvents: events.slice(0, 5),
  };
}

/** All device tokens for an org's staff/admin users (chronic-absence alerts etc.). */
export async function getDeviceTokensForOrgStaff(organizationId: number): Promise<string[]> {
  const db = await requireDb();
  const rows = await db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .innerJoin(users, eq(deviceTokens.userId, users.id))
    .where(and(eq(users.organizationId, organizationId), inArray(users.role, ["admin", "staff"])));
  return rows.map(r => r.token);
}

/**
 * Kiosk check-in/out: upsert ONE child's attendance for today without
 * touching anyone else's records (saveAttendanceForDate replaces the whole
 * day, which would be catastrophic from a door tablet).
 */
export async function markAttendance(
  organizationId: number,
  childId: number,
  action: "check_in" | "check_out" | "absent",
  recordedBy?: number | null,
) {
  const db = await requireDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(attendance)
    .where(and(
      eq(attendance.organizationId, organizationId),
      eq(attendance.childId, childId),
      gte(attendance.date, startOfDay),
      lte(attendance.date, endOfDay),
    ))
    .limit(1);

  if (existing) {
    await db
      .update(attendance)
      .set(
        action === "check_in"
          ? { status: "present", checkInTime: existing.checkInTime ?? now, checkOutTime: null }
          : action === "check_out"
            ? { status: "present", checkInTime: existing.checkInTime ?? now, checkOutTime: now }
            : { status: "absent", checkInTime: null, checkOutTime: null },
      )
      .where(eq(attendance.id, existing.id));
    return { id: existing.id, updated: true };
  }

  const [ins] = await db.insert(attendance).values({
    organizationId,
    childId,
    date: startOfDay,
    status: action === "absent" ? "absent" : "present",
    checkInTime: action === "absent" ? null : now,
    checkOutTime: action === "check_out" ? now : null,
    recordedBy: recordedBy ?? null,
  });
  return { id: ins.insertId, updated: false };
}

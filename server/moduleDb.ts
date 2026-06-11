/**
 * Query helpers for the full module surface of the web app:
 * classrooms, calendar, billing, meals, documents, staff ops, parent portal,
 * AI insights, bulk actions, notes, custom reports, and dashboard stats.
 */
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  families, children, staff, classrooms, childClassroomAssignments,
  attendance, healthRecords, studentNotes, calendarEvents, documents,
  bulkActionLogs, aiInsights, invoices, payments, activityLogs,
  parentNotifications, digitalDocuments, mealPlans, mealItems, cacfpReports,
  timeClock, certifications, customReports, educationRecords, pirData,
  familyContactAddresses,
  InsertFamily, InsertStaff, InsertStudentNote, InsertCalendarEvent,
  InsertDocument, InsertDigitalDocument, InsertInvoice, InsertPayment,
  InsertMealPlan, InsertMealItem, InsertCertification, InsertCustomReport,
  InsertEducationRecord, InsertAiInsight, InsertBulkActionLog,
  InsertActivityLog, InsertAttendance,
} from "../drizzle/schema";
import { getDb } from "./db";

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

export async function getFamilyContacts(familyId: number) {
  const db = await requireDb();
  return db.select().from(familyContactAddresses).where(eq(familyContactAddresses.familyId, familyId));
}

// ==================== CHILDREN ====================

export async function updateChild(id: number, data: Partial<typeof children.$inferInsert>) {
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
  const db = await requireDb();
  await db.update(staff).set(data).where(eq(staff.id, id));
  return { success: true };
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

export async function createDocument(data: InsertDocument) {
  const db = await requireDb();
  const [result] = await db.insert(documents).values(data);
  return { id: result.insertId };
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

export async function getCertifications(organizationId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ cert: certifications, firstName: staff.firstName, lastName: staff.lastName })
    .from(certifications)
    .innerJoin(staff, eq(certifications.staffId, staff.id))
    .where(eq(staff.organizationId, organizationId))
    .orderBy(certifications.expiryDate);
  return rows.map(r => ({ ...r.cert, staffName: `${r.firstName} ${r.lastName}` }));
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
    .orderBy(desc(activityLogs.timestamp));
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

export async function getParentNotifications(familyId: number) {
  const db = await requireDb();
  return db.select().from(parentNotifications).where(eq(parentNotifications.familyId, familyId)).orderBy(desc(parentNotifications.createdAt));
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
  const existing = await db.select().from(pirData).where(and(
    eq(pirData.organizationId, organizationId),
    eq(pirData.year, year),
    eq(pirData.questionId, questionId),
  ));
  if (existing.length > 0) {
    await db.update(pirData).set({ value, updatedBy: updatedBy ?? null }).where(eq(pirData.id, existing[0].id));
    return { id: existing[0].id };
  }
  const [result] = await db.insert(pirData).values({ organizationId, year, section, questionId, value, updatedBy: updatedBy ?? null });
  return { id: result.insertId };
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

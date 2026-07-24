import { and, desc, eq, gte, inArray, lt, lte, or } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  absenceReports,
  approvalRequests,
  attendance,
  attendancePlans,
  calendarEvents,
  chatMessages,
  children,
  classrooms,
  childClassroomAssignments,
  communicationLogs,
  conversations,
  digitalDocuments,
  documents,
  families,
  familyCaseNotes,
  familyNeedsAssessments,
  organizations,
  staff,
  type User,
} from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb, getHealthFollowUpAlerts } from "./db";
import { resolveStaffId } from "./moduleDb";
import { userHasModule } from "./_core/modules";

/**
 * REST dashboard endpoint for the staff iOS app (GET /api/dashboard/stats).
 * Returns the DashboardData shape the app decodes: program stats plus a list
 * of alerts computed from live data — attendance concerns, health records
 * coming due, undelivered family messages, and documents awaiting signature.
 */

const ATTENDANCE_ALERT_THRESHOLD = 85; // percent

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

export type DashboardAlert = { id: string; title: string; description: string; type: string; filter?: string };

export type DashboardCaseloadChild = {
  id: string;
  firstName: string;
  lastName: string;
  attendanceStatus: "present" | "absent" | "unknown";
};

/**
 * `type` + the fields needed to reconstruct the matching iOS
 * `DashboardTask.TaskDestination` case client-side (see DashboardView.swift):
 *   "documentSign" -> .documentSign(familyName:, documentType:)
 *   "healthRecord" -> .healthRecord(childName:, category:)
 *   "family"       -> .family(name:, tab:)
 *   "attendance"   -> .attendance
 */
export type DashboardTaskItem = {
  id: string;
  title: string;
  dueLabel: string;
  urgency: "overdue" | "today" | "upcoming";
  type: "documentSign" | "healthRecord" | "family" | "attendance";
  familyName?: string;
  documentType?: string;
  childName?: string;
  category?: string;
  tab?: string;
};

/** `type` mirrors DashboardTaskItem's convention: "messages" | "familyServices". */
export type DashboardAgendaItem = {
  id: string;
  timeLabel: string;
  title: string;
  subtitle?: string | null;
  colorType: string;
  type: "messages" | "familyServices";
};

const HEALTH_CATEGORY_MAP: Record<string, string> = {
  immunization: "immunizations",
  physical: "physical",
  dental: "dental",
  vision: "vision",
  hearing: "hearing",
};

/** "Overdue" / "Due today" / "Due Jul 14" relative to today, local time. */
function dueLabelFor(date: Date, now: Date): { label: string; urgency: "overdue" | "today" | "upcoming" } {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((date.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: "Overdue", urgency: "overdue" };
  if (diffDays === 0) return { label: "Due today", urgency: "today" };
  return { label: `Due ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, urgency: "upcoming" };
}

/**
 * Shared dashboard computation — stats + actionable alerts from live data.
 * Used by both the REST /api/dashboard/stats endpoint (iOS) and the
 * dashboard.alerts tRPC query (web notification bell). Returns null if the DB
 * is unavailable.
 */
export async function computeDashboard(user: User) {
    const db = await getDb();
    if (!db) return null;

    // Scope to the caller's organization; no first-org fallback.
    const org = user.organizationId != null ? { id: user.organizationId } : null;
    if (!org) {
      return {
        stats: { totalEnrolled: 0, attendanceRate: 0, healthDue: 0, complianceScore: 0 },
        alerts: [] as DashboardAlert[],
        caseload: [] as DashboardCaseloadChild[],
        tasks: [] as DashboardTaskItem[],
        agenda: [] as DashboardAgendaItem[],
      };
    }

    const kids = await db
      .select({ id: children.id, firstName: children.firstName, lastName: children.lastName })
      .from(children)
      .where(and(eq(children.organizationId, org.id), eq(children.status, "active")));

    // --- Attendance (last 30 days) ---
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const attendanceRows = await db
      .select({ childId: attendance.childId, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.organizationId, org.id), gte(attendance.date, since)));

    const isPresent = (s: string | null) => s === "present" || s === "half_day";
    const orgRate =
      attendanceRows.length > 0
        ? Math.round((attendanceRows.filter(r => isPresent(r.status)).length / attendanceRows.length) * 100)
        : 100;

    const lowAttendance = kids
      .map(k => {
        const rows = attendanceRows.filter(r => r.childId === k.id);
        if (rows.length === 0) return null;
        const rate = Math.round((rows.filter(r => isPresent(r.status)).length / rows.length) * 100);
        return rate < ATTENDANCE_ALERT_THRESHOLD
          ? { name: `${k.firstName} ${k.lastName}`, rate }
          : null;
      })
      .filter((x): x is { name: string; rate: number } => x !== null)
      .sort((a, b) => a.rate - b.rate);

    // --- Health records due/overdue within 30 days ---
    const healthAlerts = await getHealthFollowUpAlerts(org.id, 30);
    const overdueCount = healthAlerts.filter(a => a.severity === "overdue").length;

    // --- Family messages that never went out ---
    const stuckMessages = await db
      .select({ id: communicationLogs.id, status: communicationLogs.status })
      .from(communicationLogs)
      .where(
        and(
          eq(communicationLogs.organizationId, org.id),
          inArray(communicationLogs.status, ["pending", "failed"])
        )
      );
    const failedCount = stuckMessages.filter(m => m.status === "failed").length;

    // --- Unread parent messages (in-app conversations) ---
    let unreadFromParents = 0;
    let lastUnreadPreview: { familyName: string; body: string; sentAt: Date } | null = null;
    const threads = await db
      .select({ id: conversations.id, familyId: conversations.familyId, staffLastReadAt: conversations.staffLastReadAt, familyName: families.primaryContactName })
      .from(conversations)
      .innerJoin(families, eq(conversations.familyId, families.id))
      .where(and(eq(conversations.organizationId, org.id), eq(conversations.isActive, 1)));

    // This used to run one "latest message" query per conversation thread
    // on every dashboard load — fine with a handful of families, but an
    // N+1 that scales linearly with conversation count. One query for all
    // family-sent messages across every thread, ordered so the first row
    // seen per conversationId is that thread's latest, replaces the loop.
    const threadIds = threads.map(t => t.id);
    const familyMessages = threadIds.length === 0 ? [] : await db
      .select({ conversationId: chatMessages.conversationId, sentAt: chatMessages.sentAt, body: chatMessages.body })
      .from(chatMessages)
      .where(and(inArray(chatMessages.conversationId, threadIds), eq(chatMessages.senderRole, "family")))
      .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id));
    const latestByConversation = new Map<number, { sentAt: Date; body: string }>();
    for (const m of familyMessages) {
      if (!latestByConversation.has(m.conversationId)) {
        latestByConversation.set(m.conversationId, { sentAt: m.sentAt, body: m.body });
      }
    }
    for (const t of threads) {
      const latestFromFamily = latestByConversation.get(t.id);
      if (
        latestFromFamily &&
        (t.staffLastReadAt == null || latestFromFamily.sentAt > t.staffLastReadAt)
      ) {
        unreadFromParents++;
        if (!lastUnreadPreview || latestFromFamily.sentAt > lastUnreadPreview.sentAt) {
          lastUnreadPreview = { familyName: t.familyName, body: latestFromFamily.body, sentAt: latestFromFamily.sentAt };
        }
      }
    }

    // --- Documents awaiting signature or expired ---
    const pendingDocs = await db
      .select({ id: digitalDocuments.id, status: digitalDocuments.status })
      .from(digitalDocuments)
      .where(and(eq(digitalDocuments.organizationId, org.id), eq(digitalDocuments.status, "pending")));
    const expiredDocs = await db
      .select({ id: digitalDocuments.id })
      .from(digitalDocuments)
      .where(
        and(
          eq(digitalDocuments.organizationId, org.id),
          eq(digitalDocuments.status, "signed"),
          lt(digitalDocuments.expiresAt, new Date())
        )
      );

    const signedRatioBase = pendingDocs.length + expiredDocs.length;
    const complianceScore = Math.max(0, 100 - signedRatioBase * 5);

    // --- Assemble alerts (most actionable first) ---
    const alerts: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      /** Optional destination hint, e.g. a health status filter. */
      filter?: string;
    }> = [];

    if (lowAttendance.length > 0) {
      const names = lowAttendance.slice(0, 3).map(c => `${c.name} (${c.rate}%)`).join(", ");
      const extra = lowAttendance.length > 3 ? ` and ${lowAttendance.length - 3} more` : "";
      alerts.push({
        id: "alert-attendance",
        title: `${lowAttendance.length} ${lowAttendance.length === 1 ? "Child" : "Children"} Below ${ATTENDANCE_ALERT_THRESHOLD}% Attendance`,
        description: `${names}${extra} may need attendance success plans.`,
        type: "attendance",
      });
    }

    if (healthAlerts.length > 0) {
      const byType = new Map<string, number>();
      for (const a of healthAlerts) byType.set(a.type, (byType.get(a.type) ?? 0) + 1);
      const summary = Array.from(byType.entries()).map(([t, n]) => `${n} ${t}`).join(", ");
      alerts.push({
        id: "alert-health",
        title: `${healthAlerts.length} Health Record${healthAlerts.length === 1 ? "" : "s"} Due This Month`,
        description: `${summary}${overdueCount > 0 ? ` — ${overdueCount} overdue` : ""}. Tap to review and schedule.`,
        type: "health",
        filter: overdueCount > 0 ? "Overdue" : "Due Soon",
      });
    }

    // --- Parent-reported absences awaiting advocate review ---
    const pendingAbsences = await db
      .select({ id: absenceReports.id })
      .from(absenceReports)
      .where(and(eq(absenceReports.organizationId, org.id), eq(absenceReports.status, "pending")));
    if (pendingAbsences.length > 0) {
      alerts.push({
        id: "alert-absences",
        title: `${pendingAbsences.length} Absence Report${pendingAbsences.length === 1 ? "" : "s"} to Review`,
        description: "Families reported their children out. Approve to mark the day excused.",
        type: "absence",
      });
    }

    // --- Manager requests awaiting a higher-up's sign-off (admins only) ---
    if (user.role === "admin") {
      const pendingApprovals = await db
        .select({ id: approvalRequests.id })
        .from(approvalRequests)
        .where(and(eq(approvalRequests.organizationId, org.id), eq(approvalRequests.status, "pending")));
      if (pendingApprovals.length > 0) {
        alerts.push({
          id: "alert-approvals",
          title: `${pendingApprovals.length} Approval${pendingApprovals.length === 1 ? "" : "s"} Awaiting Review`,
          description: "Staff hires, role changes, or new roles need your sign-off. Tap to review.",
          type: "approval",
        });
      }
    }

    if (unreadFromParents > 0) {
      alerts.push({
        id: "alert-unread-parent-messages",
        title: `${unreadFromParents} New Parent Message${unreadFromParents === 1 ? "" : "s"}`,
        description: "Families are waiting on a reply. Tap to open your inbox.",
        type: "message",
      });
    }

    if (stuckMessages.length > 0) {
      alerts.push({
        id: "alert-messages",
        title: `${stuckMessages.length} Family Message${stuckMessages.length === 1 ? "" : "s"} Not Delivered`,
        description:
          failedCount > 0
            ? `${failedCount} failed to send and need to be resent.`
            : "Queued messages haven't gone out yet.",
        type: "message",
      });
    }

    if (signedRatioBase > 0) {
      const parts: string[] = [];
      if (pendingDocs.length > 0) parts.push(`${pendingDocs.length} awaiting signature`);
      if (expiredDocs.length > 0) parts.push(`${expiredDocs.length} expired and need renewal`);
      alerts.push({
        id: "alert-documents",
        title: `${signedRatioBase} Document${signedRatioBase === 1 ? "" : "s"} Need Attention`,
        description: `${parts.join(", ")}.`,
        type: "document",
      });
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // --- My Caseload: children in classrooms this staff member teaches/assists ---
    const staffId = await resolveStaffId(org.id, user.id);
    let myKids = kids;
    if (staffId != null) {
      const myRooms = await db
        .select({ id: classrooms.id })
        .from(classrooms)
        .where(and(eq(classrooms.organizationId, org.id), or(eq(classrooms.teacherId, staffId), eq(classrooms.assistantId, staffId))));
      if (myRooms.length > 0) {
        const roomIds = myRooms.map(r => r.id);
        const assigned = await db
          .select({ childId: childClassroomAssignments.childId })
          .from(childClassroomAssignments)
          .where(and(inArray(childClassroomAssignments.classroomId, roomIds), eq(childClassroomAssignments.isActive, 1)));
        const idSet = new Set(assigned.map(a => a.childId));
        myKids = kids.filter(k => idSet.has(k.id));
      }
    }
    // No classroom assignment (admin, family advocate, etc.) — fall back to the
    // org roster rather than showing an empty "my caseload" widget.
    if (myKids.length === 0) myKids = kids;
    myKids = [...myKids].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

    const todayAttendance = await db
      .select({ childId: attendance.childId, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.organizationId, org.id), gte(attendance.date, startOfToday), lte(attendance.date, endOfToday)));
    const statusByChild = new Map(todayAttendance.map(r => [r.childId, r.status]));
    const caseload: DashboardCaseloadChild[] = myKids.slice(0, 8).map(c => {
      const raw = statusByChild.get(c.id);
      const attendanceStatus: DashboardCaseloadChild["attendanceStatus"] =
        raw === "present" || raw === "half_day" ? "present" : raw === "absent" || raw === "excused" ? "absent" : "unknown";
      return { id: String(c.id), firstName: c.firstName, lastName: c.lastName, attendanceStatus };
    });

    // --- Pending Tasks: real due/overdue work, not a fixed demo list ---
    const tasks: DashboardTaskItem[] = [];

    const docTaskRows = await db
      .select({
        id: digitalDocuments.id,
        documentType: digitalDocuments.documentType,
        expiresAt: digitalDocuments.expiresAt,
        familyName: families.primaryContactName,
      })
      .from(digitalDocuments)
      .innerJoin(families, eq(digitalDocuments.familyId, families.id))
      .where(and(eq(digitalDocuments.organizationId, org.id), eq(digitalDocuments.status, "pending")));
    for (const d of docTaskRows) {
      const due = d.expiresAt ? dueLabelFor(new Date(d.expiresAt), now) : { label: "Needs signature", urgency: "upcoming" as const };
      tasks.push({
        id: `doc-${d.id}`,
        title: `Sign ${d.familyName}'s ${d.documentType.replace(/_/g, " ")} form`,
        dueLabel: due.label,
        urgency: due.urgency,
        type: "documentSign",
        familyName: d.familyName,
        documentType: d.documentType,
      });
    }

    for (const a of healthAlerts.slice(0, 5)) {
      const due = dueLabelFor(new Date(a.expiryDate), now);
      tasks.push({
        id: `health-${a.recordId}`,
        title: `${a.type === "immunization" ? "Update" : "Schedule"} ${a.childName}'s ${a.type} ${a.type === "immunization" ? "record" : "screening"}`,
        dueLabel: due.label,
        urgency: a.severity === "overdue" ? "overdue" : due.urgency,
        type: "healthRecord",
        childName: a.childName,
        category: HEALTH_CATEGORY_MAP[a.type] ?? a.type,
      });
    }

    // Head Start-only task sources — skipped entirely for orgs without the module.
    if (await userHasModule(user, "head_start")) {
      const fnaRows = await db
        .select({ id: familyNeedsAssessments.id, familyName: families.primaryContactName })
        .from(familyNeedsAssessments)
        .innerJoin(families, eq(familyNeedsAssessments.familyId, families.id))
        .where(and(eq(familyNeedsAssessments.organizationId, org.id), lt(familyNeedsAssessments.reviewDate, now)));
      for (const f of fnaRows) {
        tasks.push({ id: `fna-${f.id}`, title: `Review ${f.familyName}'s Family Needs Assessment`, dueLabel: "Overdue", urgency: "overdue", type: "family", familyName: f.familyName, tab: "fna" });
      }

      const noteRows = await db
        .select({ id: familyCaseNotes.id, familyName: families.primaryContactName })
        .from(familyCaseNotes)
        .innerJoin(families, eq(familyCaseNotes.familyId, families.id))
        .where(and(
          eq(familyCaseNotes.organizationId, org.id),
          eq(familyCaseNotes.followUpRequired, 1),
          eq(familyCaseNotes.followUpCompleted, 0),
          lt(familyCaseNotes.followUpDue, now),
        ));
      for (const n of noteRows) {
        tasks.push({ id: `note-${n.id}`, title: `Follow up with ${n.familyName} (case note)`, dueLabel: "Overdue", urgency: "overdue", type: "family", familyName: n.familyName, tab: "notes" });
      }

      const planRows = await db
        .select({ id: attendancePlans.id, childId: attendancePlans.childId })
        .from(attendancePlans)
        .where(and(eq(attendancePlans.organizationId, org.id), eq(attendancePlans.status, "active"), lt(attendancePlans.reviewDate, now)));
      if (planRows.length > 0) {
        const nameById = new Map(kids.map(k => [k.id, `${k.firstName} ${k.lastName}`]));
        for (const p of planRows) {
          tasks.push({ id: `plan-${p.id}`, title: `Review ${nameById.get(p.childId) ?? "a child"}'s attendance plan`, dueLabel: "Overdue", urgency: "overdue", type: "attendance" });
        }
      }
    }

    const urgencyOrder = { overdue: 0, today: 1, upcoming: 2 } as const;
    tasks.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    const cappedTasks = tasks.slice(0, 8);

    // --- Today's Agenda: real calendar events, not invented meetings ---
    const todaysEvents = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.organizationId, org.id), gte(calendarEvents.startDate, startOfToday), lte(calendarEvents.startDate, endOfToday)))
      .orderBy(calendarEvents.startDate);
    const agenda: DashboardAgendaItem[] = todaysEvents.slice(0, 6).map(e => ({
      id: `event-${e.id}`,
      timeLabel: e.allDay ? "All day" : new Date(e.startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      title: e.title,
      subtitle: e.location || null,
      colorType: e.eventType ?? "other",
      // Calendar events aren't tied to a specific screen, so route by type: staff/
      // parent-facing events land on Messages, everything else on Family Services.
      type: e.eventType === "parent_event" || e.eventType === "staff_training" ? "messages" : "familyServices",
    }));

    const totalDocuments = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.organizationId, org.id));

    return {
      stats: {
        totalEnrolled: kids.length,
        attendanceRate: orgRate,
        healthDue: healthAlerts.length,
        complianceScore,
      },
      alerts,
      caseload,
      tasks: cappedTasks,
      agenda,
      inbox: {
        unreadMessageCount: unreadFromParents,
        lastMessagePreview: lastUnreadPreview ? `${lastUnreadPreview.familyName}: ${lastUnreadPreview.body}` : "",
      },
      documents: {
        totalDocumentCount: totalDocuments.length,
        pendingDocumentCount: pendingDocs.length,
      },
    };
}

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const data = await computeDashboard(user);
    if (!data) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    res.json(data);
  });
}

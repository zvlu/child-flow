import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  absenceReports,
  attendance,
  chatMessages,
  children,
  communicationLogs,
  conversations,
  digitalDocuments,
  organizations,
  type User,
} from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb, getHealthFollowUpAlerts } from "./db";

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

/**
 * Shared dashboard computation — stats + actionable alerts from live data.
 * Used by both the REST /api/dashboard/stats endpoint (iOS) and the
 * dashboard.alerts tRPC query (web notification bell). Returns null if the DB
 * is unavailable.
 */
export async function computeDashboard(organizationId: number | null) {
    const db = await getDb();
    if (!db) return null;

    // Scope to the caller's organization; no first-org fallback.
    const org = organizationId != null ? { id: organizationId } : null;
    if (!org) {
      return { stats: { totalEnrolled: 0, attendanceRate: 0, healthDue: 0, complianceScore: 0 }, alerts: [] as DashboardAlert[] };
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
    const threads = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.organizationId, org.id), eq(conversations.isActive, 1)));
    for (const t of threads) {
      const [latestFromFamily] = await db
        .select({ sentAt: chatMessages.sentAt })
        .from(chatMessages)
        .where(and(eq(chatMessages.conversationId, t.id), eq(chatMessages.senderRole, "family")))
        .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id))
        .limit(1);
      if (
        latestFromFamily &&
        (t.staffLastReadAt == null || latestFromFamily.sentAt > t.staffLastReadAt)
      ) {
        unreadFromParents++;
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

    return {
      stats: {
        totalEnrolled: kids.length,
        attendanceRate: orgRate,
        healthDue: healthAlerts.length,
        complianceScore,
      },
      alerts,
    };
}

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const data = await computeDashboard(user.organizationId);
    if (!data) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    res.json(data);
  });
}

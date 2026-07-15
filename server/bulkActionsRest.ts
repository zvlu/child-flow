import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { classrooms, type User } from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, insertAuditLog } from "./db";
import {
  createBulkActionLog,
  getBulkActionLogs,
  getClassroomRoster,
  resolveStaffId,
  saveAttendanceForDate,
} from "./moduleDb";

/**
 * REST backing for the "Bulk Action Center" (iOS + parity with the web
 * tRPC `bulkActions` router). Unlike most of the compliance-heavy screens in
 * this app, this feature is NOT Head-Start-gated — it's generic and works
 * for any org type.
 *
 *   GET  /api/bulk-actions/logs         action-history log (staff or admin)
 *   POST /api/bulk-actions/attendance   mass-mark a classroom's attendance (admin only)
 *
 * bulkHealthScreening / bulkNotes / bulkEnrollment have no backing mutation
 * anywhere in this codebase (the web UI only shows them as "coming soon"
 * toasts) — intentionally not implemented here either.
 */

const ATTENDANCE_STATUSES = ["present", "absent", "excused", "half_day"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" ? user : null;
  } catch {
    return null;
  }
}

export function registerBulkActionsRoutes(app: Express) {
  app.get("/api/bulk-actions/logs", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const org = user.organizationId != null ? { id: user.organizationId } : null;
    if (!org) {
      res.json([]);
      return;
    }

    const logs = await getBulkActionLogs(org.id);
    // iOS models every id as a String (see other *Rest.ts files) — the raw
    // rows from moduleDb carry numeric ids.
    res.json(
      logs.map(l => ({
        id: String(l.id),
        organizationId: l.organizationId,
        classroomId: String(l.classroomId),
        classroomName: l.classroomName,
        actionType: l.actionType,
        description: l.description,
        recordCount: l.recordCount,
        status: l.status,
        performedBy: String(l.performedBy),
        performedByName: l.performedByName,
        actionDate: l.actionDate,
        completedAt: l.completedAt,
      }))
    );
  });

  app.post("/api/bulk-actions/attendance", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user) {
      res.status(401).json({ error: "Bulk attendance requires an admin account" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const org = user.organizationId != null ? { id: user.organizationId } : null;
    if (!org) {
      res.status(404).json({ error: "No organization" });
      return;
    }

    const classroomId = Number(req.body?.classroomId);
    const dateStr = typeof req.body?.date === "string" ? req.body.date : "";
    const status = String(req.body?.status ?? "");
    if (!classroomId || !dateStr || !ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
      res.status(400).json({ error: "classroomId, date, and a valid status are required" });
      return;
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    // The classroomId comes straight from the request body — without this
    // check, an admin at one org could mass-mark attendance for a classroom
    // belonging to a completely different organization.
    const [classroom] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.organizationId, org.id)))
      .limit(1);
    if (!classroom) {
      res.status(404).json({ error: "Classroom not found" });
      return;
    }

    const performedBy = await resolveStaffId(org.id, user.id);
    if (performedBy == null) {
      res.status(400).json({ error: "No staff record to attribute this action to." });
      return;
    }

    const roster = await getClassroomRoster(classroomId);
    await saveAttendanceForDate(
      org.id,
      date,
      roster.map(c => ({ childId: c.id, status: status as AttendanceStatus })),
      performedBy
    );
    await createBulkActionLog({
      organizationId: org.id,
      classroomId,
      actionType: "bulk_attendance",
      description: `Marked ${roster.length} children ${status}`,
      recordCount: roster.length,
      status: "completed",
      performedBy,
    });
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "bulk_action",
      resourceId: String(classroomId),
      ipAddress: clientIpFromReq(req),
      detail: `bulk attendance: marked ${roster.length} children ${status}`,
    });

    res.json({ success: true, affected: roster.length });
  });
}

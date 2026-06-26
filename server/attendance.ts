import { and, eq, gte, lte } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { attendance, children, organizations, type User } from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, insertAuditLog } from "./db";
import {
  createStudentNote,
  getChildClassroomMap,
  saveAttendanceForDate,
} from "./moduleDb";

/**
 * REST backing for the teacher "Classroom Today" flow (attendance + quick
 * notes in one screen). Previously the iOS attendance screen ran on mock data
 * because these endpoints didn't exist.
 *
 *   GET  /api/attendance?date=&classroom=   roster with today's status
 *   POST /api/attendance/bulk               save the day's statuses
 *   POST /api/children/:id/notes            add a quick note to a child
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

// iOS AttendanceStatus uses camelCase ("halfDay"); the DB enum uses "half_day".
const toClient = (s: string | null): string => (s === "half_day" ? "halfDay" : s ?? "present");
const toDb = (s: string): "present" | "absent" | "excused" | "half_day" =>
  s === "halfDay" ? "half_day" : (["present", "absent", "excused"].includes(s) ? s : "present") as any;

export function registerAttendanceRoutes(app: Express) {
  app.get("/api/attendance", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const org = user.organizationId != null ? { id: user.organizationId } : null;
    if (!org) {
      res.json({ records: [], classrooms: [] });
      return;
    }

    const dateStr = typeof req.query.date === "string" ? req.query.date : "";
    const date = dateStr ? new Date(dateStr) : new Date();
    const classroomFilter = typeof req.query.classroom === "string" ? req.query.classroom : null;

    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    const kids = await db
      .select()
      .from(children)
      .where(and(eq(children.organizationId, org.id), eq(children.status, "active")));
    const map = await getChildClassroomMap(org.id);
    const roomByChild = new Map(map.map(m => [m.childId, m.classroomName]));
    const existing = await db
      .select({ childId: attendance.childId, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.organizationId, org.id), gte(attendance.date, start), lte(attendance.date, end)));
    const statusByChild = new Map(existing.map(r => [r.childId, r.status]));

    const classroomNames = Array.from(new Set(map.map(m => m.classroomName).filter(Boolean))).sort();

    const records = kids
      .filter(c => !classroomFilter || roomByChild.get(c.id) === classroomFilter)
      .map(c => ({
        id: statusByChild.has(c.id) ? `att-${c.id}` : `new-${c.id}`,
        childId: String(c.id),
        childName: `${c.firstName} ${c.lastName}`,
        classroom: roomByChild.get(c.id) ?? "",
        status: toClient(statusByChild.get(c.id) ?? "present"),
        date: start.toISOString(),
      }));

    res.json({ records, classrooms: classroomNames });
  });

  app.post("/api/attendance/bulk", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
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

    const rows = Array.isArray(req.body?.records) ? req.body.records : [];
    if (rows.length === 0) {
      res.json({ saved: 0 });
      return;
    }

    // All rows on this screen share one date; group defensively anyway.
    const byDate = new Map<string, Array<{ childId: number; status: ReturnType<typeof toDb> }>>();
    for (const r of rows) {
      const childId = Number(r.childId);
      if (!childId) continue;
      const dateStr = typeof r.date === "string" ? r.date : new Date().toISOString();
      const dayKey = dateStr.slice(0, 10);
      if (!byDate.has(dayKey)) byDate.set(dayKey, []);
      byDate.get(dayKey)!.push({ childId, status: toDb(String(r.status ?? "present")) });
    }

    let saved = 0;
    for (const [dayKey, recs] of Array.from(byDate)) {
      await saveAttendanceForDate(org.id, new Date(`${dayKey}T12:00:00`), recs, null);
      saved += recs.length;
    }
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "attendance",
      resourceId: null,
      ipAddress: clientIpFromReq(req),
      detail: `bulk save ${saved} records`,
    });
    res.json({ saved });
  });

  app.post("/api/children/:id/notes", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
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

    const childId = Number(req.params.id);
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const title = typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : "Quick note";
    if (!childId || !content) {
      res.status(400).json({ error: "childId and content are required" });
      return;
    }

    await createStudentNote({
      organizationId: org.id,
      childId,
      title,
      content,
      category: "quick",
    } as any);
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "student_note",
      resourceId: String(childId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

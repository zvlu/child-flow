import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  absenceReports,
  attendance,
  children,
  families,
  parentNotifications,
  type User,
} from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, insertAuditLog } from "./db";

/**
 * Parent-reported absences with family-advocate approval.
 *
 * Parent (family app):
 *   POST /api/family/absences   — "my child is not coming" (reason + note)
 *   GET  /api/family/absences   — their reports with review status
 *
 * Staff:
 *   GET  /api/absences          — reports to review (?status=pending|all)
 *   POST /api/absences/:id/review {approve} — approve writes an "excused"
 *        attendance row for that day and notifies the family; deny notifies
 *        the family to contact the program.
 */

const VALID_REASONS = ["sick", "appointment", "family_emergency", "transportation", "travel", "other"] as const;
type Reason = (typeof VALID_REASONS)[number];

const REASON_LABELS: Record<Reason, string> = {
  sick: "Illness",
  appointment: "Appointment",
  family_emergency: "Family emergency",
  transportation: "Transportation",
  travel: "Travel",
  other: "Other",
};

async function authViewer(req: Request): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function serializeReport(
  r: typeof absenceReports.$inferSelect,
  childName: string,
  familyName: string
) {
  return {
    id: String(r.id),
    childId: String(r.childId),
    childName,
    familyName,
    date: r.absenceDate.toISOString(),
    reason: r.reason,
    reasonLabel: REASON_LABELS[r.reason as Reason] ?? r.reason,
    note: r.note ?? "",
    status: r.status,
    reportedAt: r.createdAt.toISOString(),
  };
}

export function registerAbsenceRoutes(app: Express) {
  /** Parent: report an absence. */
  app.post("/api/family/absences", async (req: Request, res: Response) => {
    const user = await authViewer(req);
    if (!user || user.role !== "parent" || user.familyId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const childId = Number(req.body?.childId);
    const dateRaw = typeof req.body?.date === "string" ? req.body.date : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!childId || !dateRaw || !VALID_REASONS.includes(reason as Reason)) {
      res.status(400).json({ error: "childId, date, and a valid reason are required" });
      return;
    }
    const absenceDate = new Date(dateRaw);
    if (Number.isNaN(absenceDate.getTime())) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    // The child must belong to the reporting parent's family.
    const [child] = await db
      .select()
      .from(children)
      .where(and(eq(children.id, childId), eq(children.familyId, user.familyId)))
      .limit(1);
    if (!child) {
      res.status(403).json({ error: "Child not found in your family" });
      return;
    }

    // One report per child per day.
    const { start, end } = dayBounds(absenceDate);
    const [existing] = await db
      .select()
      .from(absenceReports)
      .where(
        and(
          eq(absenceReports.childId, childId),
          gte(absenceReports.absenceDate, start),
          lte(absenceReports.absenceDate, end)
        )
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "An absence has already been reported for that day" });
      return;
    }

    await db.insert(absenceReports).values({
      organizationId: child.organizationId,
      familyId: user.familyId,
      childId,
      absenceDate,
      reason: reason as Reason,
      note: note || null,
      reportedBy: user.id,
    });
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "absence_report",
      resourceId: String(childId),
      ipAddress: clientIpFromReq(req),
      detail: `${reason} on ${absenceDate.toISOString().slice(0, 10)}`,
    });

    const [saved] = await db
      .select()
      .from(absenceReports)
      .where(eq(absenceReports.childId, childId))
      .orderBy(desc(absenceReports.id))
      .limit(1);
    const [family] = await db.select().from(families).where(eq(families.id, user.familyId)).limit(1);
    res.json(serializeReport(saved!, `${child.firstName} ${child.lastName}`, family?.primaryContactName ?? ""));
  });

  /** Parent: list their reports (newest first). */
  app.get("/api/family/absences", async (req: Request, res: Response) => {
    const user = await authViewer(req);
    if (!user || user.role !== "parent" || user.familyId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const rows = await db
      .select({ report: absenceReports, child: children })
      .from(absenceReports)
      .innerJoin(children, eq(absenceReports.childId, children.id))
      .where(eq(absenceReports.familyId, user.familyId))
      .orderBy(desc(absenceReports.createdAt))
      .limit(20);
    const [family] = await db.select().from(families).where(eq(families.id, user.familyId)).limit(1);
    res.json(
      rows.map(r =>
        serializeReport(r.report, `${r.child.firstName} ${r.child.lastName}`, family?.primaryContactName ?? "")
      )
    );
  });

  /** Staff: reports to review. */
  app.get("/api/absences", async (req: Request, res: Response) => {
    const user = await authViewer(req);
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const statusFilter = req.query.status === "all" ? null : "pending";
    const rows = await db
      .select({ report: absenceReports, child: children, family: families })
      .from(absenceReports)
      .innerJoin(children, eq(absenceReports.childId, children.id))
      .innerJoin(families, eq(absenceReports.familyId, families.id))
      .where(statusFilter ? eq(absenceReports.status, "pending") : undefined)
      .orderBy(desc(absenceReports.createdAt))
      .limit(50);
    res.json(
      rows.map(r =>
        serializeReport(r.report, `${r.child.firstName} ${r.child.lastName}`, r.family.primaryContactName)
      )
    );
  });

  /** Staff: approve or deny a report. */
  app.post("/api/absences/:id/review", async (req: Request, res: Response) => {
    const user = await authViewer(req);
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const id = Number(req.params.id);
    const approve = req.body?.approve === true;
    const [report] = await db.select().from(absenceReports).where(eq(absenceReports.id, id)).limit(1);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    if (report.status !== "pending") {
      res.status(409).json({ error: "Report was already reviewed" });
      return;
    }

    await db
      .update(absenceReports)
      .set({ status: approve ? "approved" : "denied", reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(absenceReports.id, id));

    const [child] = await db.select().from(children).where(eq(children.id, report.childId)).limit(1);
    const childName = child ? `${child.firstName} ${child.lastName}` : "your child";
    const dateLabel = report.absenceDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    if (approve && child) {
      // Record the excused absence in attendance (update the day's row if one
      // already exists, otherwise create it).
      const { start, end } = dayBounds(report.absenceDate);
      const [existing] = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.childId, child.id),
            gte(attendance.date, start),
            lte(attendance.date, end)
          )
        )
        .limit(1);
      if (existing) {
        await db
          .update(attendance)
          .set({ status: "excused", notes: "Parent-reported absence (approved)" })
          .where(eq(attendance.id, existing.id));
      } else {
        await db.insert(attendance).values({
          organizationId: report.organizationId,
          childId: child.id,
          date: report.absenceDate,
          status: "excused",
          notes: "Parent-reported absence (approved)",
        });
      }
    }

    // Notify the family either way.
    await db.insert(parentNotifications).values({
      familyId: report.familyId,
      type: "alert",
      message: approve
        ? `${childName}'s absence on ${dateLabel} was approved and marked excused.`
        : `${childName}'s absence report for ${dateLabel} could not be approved — please contact your family advocate.`,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "absence_report",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
      detail: approve ? "approved" : "denied",
    });

    res.json({ success: true });
  });
}

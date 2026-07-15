import type { Express, Request, Response } from "express";
import { and, eq, gte } from "drizzle-orm";
import { attendance, children, staff, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, insertAuditLog } from "./db";
import { computeAuditReadiness } from "./auditReadiness";
import { getHealthDeadlineSummary } from "./healthDeadlines";

/**
 * REST backing for two more iOS staff-app screens that previously called
 * endpoints that didn't exist:
 *
 *   GET  /api/compliance          bare compliance snapshot (Compliance tab)
 *   POST /api/reports/generate    on-demand plain-text report (Reports tab)
 *
 * Both reuse the same live-computed data other features already rely on
 * (Audit Readiness, health deadlines) rather than introducing a second,
 * parallel notion of "compliance."
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

export function registerReportsRoutes(app: Express) {
  // ---- Bare Compliance snapshot ----
  // The iOS ComplianceData model wants { overallScore, pirSections,
  // checklistItems } — this app's real compliance computation is the Audit
  // Readiness score (server/auditReadiness.ts), broken into §1302 sections.
  // There's no literal "PIR sections with completion rates" table, so this
  // maps that same readiness breakdown into the shape the screen expects
  // rather than inventing a second, disconnected compliance number.
  app.get("/api/compliance", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const orgId = user.organizationId;
    if (orgId == null) {
      res.json({ overallScore: 0, pirSections: [], checklistItems: [] });
      return;
    }

    const readiness = await computeAuditReadiness(orgId);
    res.json({
      overallScore: readiness.score,
      pirSections: readiness.sections.map((s) => ({
        id: s.id,
        name: s.label,
        description: s.standard,
        completionRate: s.score ?? 0,
      })),
      checklistItems: readiness.sections.map((s) => ({
        id: s.id,
        title: s.label,
        isCompliant: s.score != null && s.score >= 75,
        note: s.detail,
      })),
    });
  });

  // ---- On-demand text report ----
  app.post("/api/reports/generate", async (req: Request, res: Response) => {
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
    const orgId = user.organizationId;
    if (orgId == null) {
      res.status(400).json({ error: "No organization" });
      return;
    }
    const type = typeof req.body?.type === "string" ? req.body.type : "enrollment";
    const now = new Date();
    const lines: string[] = [];
    let title = "Program Report";

    if (type === "attendance") {
      title = "Attendance Report";
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({ status: attendance.status })
        .from(attendance)
        .where(and(eq(attendance.organizationId, orgId), gte(attendance.date, since)));
      const present = rows.filter((r) => r.status === "present" || r.status === "half_day").length;
      const rate = rows.length ? Math.round((present / rows.length) * 100) : null;
      lines.push(`Attendance summary — last 30 days`);
      lines.push(rate != null ? `Attendance rate: ${rate}%` : "No attendance recorded in this window.");
      lines.push(`Total attendance records: ${rows.length}`);
    } else if (type === "health") {
      title = "Health Compliance Report";
      const health = await getHealthDeadlineSummary(orgId);
      lines.push(`Health screening compliance (§1302.42)`);
      lines.push(`Children tracked: ${health.childrenTracked}`);
      lines.push(`Screening complete: ${health.screeningComplete}, Dental complete: ${health.dentalComplete}`);
      lines.push(`Overdue: ${health.overdueCount}, Due soon: ${health.dueSoonCount}`);
    } else if (type === "compliance") {
      title = "Compliance Readiness Report";
      const readiness = await computeAuditReadiness(orgId);
      lines.push(`Audit Readiness Score: ${readiness.score} (${readiness.grade.replace("_", " ")})`);
      for (const s of readiness.sections) {
        lines.push(`- ${s.label} (${s.standard}): ${s.score != null ? `${s.score}/100` : "no data yet"} — ${s.detail}`);
      }
    } else if (type === "staff") {
      title = "Staffing Report";
      const rows = await db.select({ isActive: staff.isActive }).from(staff).where(eq(staff.organizationId, orgId));
      const active = rows.filter((r) => r.isActive !== 0).length;
      lines.push(`Staffing summary`);
      lines.push(`Active staff: ${active} of ${rows.length} total on record`);
    } else {
      title = "Enrollment Report";
      const rows = await db.select({ status: children.status }).from(children).where(eq(children.organizationId, orgId));
      const active = rows.filter((r) => r.status === "active").length;
      lines.push(`Enrollment summary`);
      lines.push(`Active enrollment: ${active} of ${rows.length} total on record`);
    }

    lines.push("", `Generated ${now.toLocaleString("en-US")}`);

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "report",
      resourceId: null,
      ipAddress: clientIpFromReq(req),
      detail: `generated ${type} report`,
    });

    res.json({
      id: `${type}-${now.getTime()}`,
      title,
      content: lines.join("\n"),
      generatedAt: now,
    });
  });
}

import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { organizations, pirQuestions, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, insertAuditLog } from "./db";
import {
  getPirQuestions,
  getPirReport,
  listPirReports,
  upsertPirValue,
  submitPirReport,
  reopenPirReport,
} from "./moduleDb";

/**
 * PIR (Program Information Report) endpoints for the native iOS app — the REST
 * mirror of the web's tRPC `compliance.*` routes, wrapping the same moduleDb
 * functions so web and mobile stay byte-for-byte identical.
 *
 *   GET  /api/pir/questions  — the field catalog (definitions, reference data)
 *   GET  /api/pir/reports    — every program year's report + completion counts
 *   GET  /api/pir/report?year=YYYY-YYYY — one report: catalog ⋈ saved values
 *   POST /api/pir/value      — upsert one field value (admin)
 *   POST /api/pir/submit     — mark a report submitted (admin)
 *   POST /api/pir/reopen     — reopen a submitted report (admin)
 */

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

/** The user's org. Scoped strictly — never falls back to an arbitrary org. */
async function resolveOrgId(user: User, _db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<number | null> {
  return user.organizationId;
}

export function registerPirRoutes(app: Express) {
  // Field catalog — global reference data, any internal staff may read.
  app.get("/api/pir/questions", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) { res.status(401).json({ error: "Please sign in again" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const qs = await getPirQuestions();
    res.json(qs.map(q => ({
      code: q.code,
      sectionId: q.sectionId,
      section: q.section,
      subsectionId: q.subsectionId,
      subsection: q.subsection,
      label: q.label,
      valueType: q.valueType,
      subject: q.subject,
      options: q.options ?? null,
      paired: q.paired ?? null,
      sortOrder: q.sortOrder,
    })));
  });

  // All reports for the org, newest first, with completion counts.
  app.get("/api/pir/reports", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) { res.status(401).json({ error: "Please sign in again" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) { res.json([]); return; }
    const reports = await listPirReports(orgId);
    res.json(reports.map(r => ({
      id: String(r.id),
      year: r.year,
      status: r.status,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      total: r.total,
      answered: r.answered,
    })));
  });

  // One report for a program year: the envelope + catalog joined with values.
  app.get("/api/pir/report", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) { res.status(401).json({ error: "Please sign in again" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) { res.status(400).json({ error: "No organization" }); return; }
    const year = String(req.query.year ?? "");
    if (!year) { res.status(400).json({ error: "year is required" }); return; }
    const data = await getPirReport(orgId, year);
    res.json({
      year: data.year,
      status: data.report?.status ?? "draft",
      submittedAt: data.report?.submittedAt ? data.report.submittedAt.toISOString() : null,
      totalQuestions: data.totalQuestions,
      answeredQuestions: data.answeredQuestions,
      questions: data.questions.map(q => ({
        code: q.code,
        section: q.section,
        subsection: q.subsection,
        label: q.label,
        valueType: q.valueType,
        options: q.options ?? null,
        paired: q.paired ?? null,
        value: q.value ?? null,
      })),
    });
  });

  // Upsert a single field value (admin only — PIR is federal reporting data).
  app.post("/api/pir/value", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user) { res.status(403).json({ error: "Admin access required" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) { res.status(400).json({ error: "No organization" }); return; }
    const year = String(req.body?.year ?? "");
    const code = String(req.body?.code ?? "");
    const value = String(req.body?.value ?? "");
    if (!year || !code) { res.status(400).json({ error: "year and code are required" }); return; }
    // Section label comes from the catalog so the stored row stays consistent.
    const [q] = await db.select({ section: pirQuestions.section }).from(pirQuestions).where(eq(pirQuestions.code, code));
    await upsertPirValue(orgId, year, q?.section ?? "PIR", code, value);
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "pir_data",
      resourceId: `${year}/${code}`,
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  app.post("/api/pir/submit", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user) { res.status(403).json({ error: "Admin access required" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) { res.status(400).json({ error: "No organization" }); return; }
    const year = String(req.body?.year ?? "");
    if (!year) { res.status(400).json({ error: "year is required" }); return; }
    await submitPirReport(orgId, year);
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "pir_report", resourceId: year, ipAddress: clientIpFromReq(req), detail: "submit" });
    res.json({ success: true, status: "submitted" });
  });

  app.post("/api/pir/reopen", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user) { res.status(403).json({ error: "Admin access required" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) { res.status(400).json({ error: "No organization" }); return; }
    const year = String(req.body?.year ?? "");
    if (!year) { res.status(400).json({ error: "year is required" }); return; }
    await reopenPirReport(orgId, year);
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "pir_report", resourceId: year, ipAddress: clientIpFromReq(req), detail: "reopen" });
    res.json({ success: true, status: "draft" });
  });
}

import type { Express, Request, Response } from "express";
import { organizations, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, insertAuditLog, getEducationRecords, getChildById } from "./db";
import * as mod from "./moduleDb";

/**
 * REST mirror of the web tRPC routers for the three Lillio-inspired modules, so
 * the native iOS app reaches the same data:
 *   - Lesson Planning  /api/lesson-plans …
 *   - Child Portfolios /api/portfolio …
 *   - Subsidies        /api/subsidies …
 * All wrap the same server/moduleDb functions as the web.
 */

const LESSON_DOMAINS = new Set(["social_emotional", "language_literacy", "cognition", "physical", "creative_arts", "approaches_to_learning"]);
const DAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

async function resolveOrgId(user: User, _db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<number | null> {
  // Scope strictly to the caller's org — never fall back to an arbitrary org.
  return user.organizationId;
}

/** Tenant check: does this child belong to the caller's org? */
async function childInOrg(childId: number, orgId: number): Promise<boolean> {
  const c = await getChildById(childId);
  return !!c && c.organizationId === orgId;
}

/** Tenant check: does this family belong to the caller's org? */
async function familyInOrg(familyId: number, orgId: number): Promise<boolean> {
  return (await mod.getRecordOrgId("family", familyId)) === orgId;
}

/** Local-midnight Date from a YYYY-MM-DD string (avoids the UTC day-shift). */
function localDate(s: unknown): Date | undefined {
  if (typeof s !== "string" || !s) return undefined;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

export function registerProgramModuleRoutes(app: Express) {
  // ---- Lesson Planning ----
  app.get("/api/lesson-plans", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const plans = await mod.getLessonPlans(orgId);
    res.json(plans.map(p => ({
      id: String(p.id), classroomId: String(p.classroomId), classroomName: p.classroomName,
      weekStartDate: p.weekStartDate ? new Date(p.weekStartDate).toISOString().slice(0, 10) : null,
      title: p.title ?? "", theme: p.theme ?? "", status: p.status,
    })));
  });

  app.get("/api/lesson-plans/:id", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const plan = await mod.getLessonPlan(Number(req.params.id));
    if (!plan || plan.organizationId !== orgId) return void res.status(404).json({ error: "Not found" });
    res.json({
      id: String(plan.id), classroomName: plan.classroomName,
      weekStartDate: plan.weekStartDate ? new Date(plan.weekStartDate).toISOString().slice(0, 10) : null,
      title: plan.title ?? "", theme: plan.theme ?? "", status: plan.status,
      activities: plan.activities.map(a => ({
        id: String(a.id), dayOfWeek: a.dayOfWeek, title: a.title, description: a.description ?? "", domain: a.domain ?? null,
      })),
    });
  });

  app.post("/api/lesson-plans", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const classroomId = Number(req.body?.classroomId);
    const week = localDate(req.body?.weekStartDate);
    if (!classroomId || Number.isNaN(classroomId)) return void res.status(400).json({ error: "classroomId required" });
    if (!week) return void res.status(400).json({ error: "weekStartDate (YYYY-MM-DD) required" });
    const result = await mod.createLessonPlan({
      organizationId: orgId, classroomId, weekStartDate: week,
      title: req.body?.title || undefined, theme: req.body?.theme || undefined,
    });
    res.json({ success: true, id: result.id });
  });

  app.post("/api/lesson-plans/:id/activities", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const planId = Number(req.params.id);
    if ((await mod.getLessonPlanOrg(planId)) !== orgId) return void res.status(404).json({ error: "Not found" });
    const dayOfWeek = String(req.body?.dayOfWeek ?? "");
    const title = String(req.body?.title ?? "").trim();
    const domain = req.body?.domain ? String(req.body.domain) : undefined;
    if (!DAYS.has(dayOfWeek) || !title) return void res.status(400).json({ error: "dayOfWeek and title required" });
    const result = await mod.addLessonActivity({
      lessonPlanId: planId, dayOfWeek: dayOfWeek as any, title,
      description: req.body?.description || undefined,
      domain: domain && LESSON_DOMAINS.has(domain) ? (domain as any) : undefined,
    });
    res.json({ success: true, id: result.id });
  });

  app.post("/api/lesson-plans/:id/publish", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const planId = Number(req.params.id);
    if ((await mod.getLessonPlanOrg(planId)) !== orgId) return void res.status(404).json({ error: "Not found" });
    const status = req.body?.published === false ? "draft" : "published";
    await mod.updateLessonPlan(planId, { status });
    res.json({ success: true, status });
  });

  // ---- Child Portfolios ----
  app.get("/api/portfolio", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const childId = Number(req.query.childId);
    if (!childId || Number.isNaN(childId)) return void res.status(400).json({ error: "childId required" });
    if (!(await childInOrg(childId, orgId))) return void res.status(403).json({ error: "You don't have access to that child." });
    const entries = await mod.getPortfolioEntries(childId);
    res.json(entries.map(e => ({
      id: String(e.id), childId: String(e.childId), title: e.title, observation: e.observation ?? "",
      domain: e.domain ?? null, authorName: e.authorName ?? null,
      observedAt: e.observedAt ? new Date(e.observedAt).toISOString().slice(0, 10) : null,
    })));
  });

  app.post("/api/portfolio", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const childId = Number(req.body?.childId);
    const title = String(req.body?.title ?? "").trim();
    const domain = req.body?.domain ? String(req.body.domain) : undefined;
    if (!childId || Number.isNaN(childId) || !title) return void res.status(400).json({ error: "childId and title required" });
    if (!(await childInOrg(childId, orgId))) return void res.status(403).json({ error: "You don't have access to that child." });
    const createdBy = await mod.resolveStaffId(orgId, user.id);
    const result = await mod.createPortfolioEntry({
      organizationId: orgId, childId, title,
      observation: req.body?.observation || undefined,
      domain: domain && LESSON_DOMAINS.has(domain) ? (domain as any) : undefined,
      observedAt: localDate(req.body?.observedAt),
      createdBy: createdBy ?? undefined,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "portfolio_entry", resourceId: String(childId), ipAddress: clientIpFromReq(req) });
    res.json({ success: true, id: result.id });
  });

  // ---- Subsidies ----
  app.get("/api/subsidies", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const subs = await mod.getSubsidies(orgId);
    res.json(subs.map(s => ({
      id: String(s.id), familyId: String(s.familyId), familyName: s.familyName,
      agencyName: s.agencyName, caseNumber: s.caseNumber ?? "",
      authorizedAmount: s.authorizedAmount ?? null, copayAmount: s.copayAmount ?? null,
      status: s.status,
      startDate: s.startDate ? new Date(s.startDate).toISOString().slice(0, 10) : null,
      endDate: s.endDate ? new Date(s.endDate).toISOString().slice(0, 10) : null,
      notes: s.notes ?? "",
    })));
  });

  app.post("/api/subsidies", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const familyId = Number(req.body?.familyId);
    const agencyName = String(req.body?.agencyName ?? "").trim();
    if (!familyId || Number.isNaN(familyId) || !agencyName) return void res.status(400).json({ error: "familyId and agencyName required" });
    if (!(await familyInOrg(familyId, orgId))) return void res.status(403).json({ error: "You don't have access to that family." });
    const status = ["active", "pending", "expired"].includes(req.body?.status) ? req.body.status : "active";
    const result = await mod.createSubsidy({
      organizationId: orgId, familyId, agencyName,
      caseNumber: req.body?.caseNumber || undefined,
      authorizedAmount: req.body?.authorizedAmount || undefined,
      copayAmount: req.body?.copayAmount || undefined,
      startDate: localDate(req.body?.startDate), endDate: localDate(req.body?.endDate),
      status, notes: req.body?.notes || undefined,
    });
    res.json({ success: true, id: result.id });
  });

  // ---- Assessments (education records) ----
  app.get("/api/assessments", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const childId = req.query.childId ? Number(req.query.childId) : undefined;
    const rows = await getEducationRecords(orgId, childId && !Number.isNaN(childId) ? childId : undefined);
    res.json(rows.map(r => ({
      id: String(r.id), childId: String(r.childId), type: r.type,
      title: r.title, description: r.description ?? "",
      score: r.score ?? "", domain: r.domain ?? "",
      assessmentDate: r.assessmentDate ? new Date(r.assessmentDate).toISOString().slice(0, 10) : null,
    })));
  });

  app.post("/api/assessments", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const childId = Number(req.body?.childId);
    const title = String(req.body?.title ?? "").trim();
    const t = String(req.body?.type ?? "assessment");
    const type = ["assessment", "parent_conference", "home_visit", "individual_plan"].includes(t) ? t : "assessment";
    if (!childId || Number.isNaN(childId) || !title) return void res.status(400).json({ error: "childId and title required" });
    if (!(await childInOrg(childId, orgId))) return void res.status(403).json({ error: "You don't have access to that child." });
    const result = await mod.createEducationRecord({
      organizationId: orgId, childId, type: type as any, title,
      description: req.body?.description || undefined,
      assessmentDate: localDate(req.body?.assessmentDate) ?? new Date(),
      score: req.body?.score || undefined,
      domain: req.body?.domain || undefined,
    });
    res.json({ success: true, id: result.id });
  });

  // ---- Calendar ----
  app.get("/api/calendar", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const rows = await mod.getCalendarEvents(orgId);
    res.json(rows.map(e => ({
      id: String(e.id), title: e.title, description: e.description ?? "",
      eventType: e.eventType ?? "other",
      startDate: e.startDate.toISOString(),
      endDate: e.endDate ? e.endDate.toISOString() : null,
      location: e.location ?? "", allDay: e.allDay ?? 1,
    })));
  });

  app.post("/api/calendar", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return void res.status(400).json({ error: "title required" });
    const et = String(req.body?.eventType ?? "other");
    const eventType = ["holiday", "school_event", "parent_event", "staff_training", "deadline", "other"].includes(et) ? et : "other";
    const result = await mod.createCalendarEvent({
      organizationId: orgId, title,
      description: req.body?.description || undefined,
      eventType: eventType as any,
      startDate: req.body?.startDate ? new Date(req.body.startDate) : new Date(),
      endDate: req.body?.endDate ? new Date(req.body.endDate) : undefined,
      location: req.body?.location || undefined,
    });
    res.json({ success: true, id: result.id });
  });

  // ---- Meal plans (read-only on mobile) ----
  app.get("/api/meals", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const plans = await mod.getMealPlans(orgId);
    res.json(plans.map(p => ({
      id: String(p.id), classroomName: p.classroomName,
      weekStartDate: p.weekStartDate ? new Date(p.weekStartDate).toISOString().slice(0, 10) : null,
      status: p.status,
    })));
  });

  app.get("/api/meals/:id/items", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    if ((await mod.getRecordOrgId("mealPlan", Number(req.params.id))) !== orgId) return void res.status(404).json({ error: "Not found" });
    const items = await mod.getMealItems(Number(req.params.id));
    res.json(items.map(i => ({
      id: String(i.id), dayOfWeek: i.dayOfWeek, mealType: i.mealType,
      description: i.description, servings: i.servings ?? null,
    })));
  });

  // ---- Staff Activity report (family-advocate workload) ----
  // ?preset=month|lastMonth|90d|year & optional ?staffId=123. The server resolves
  // the date window so the iOS client only passes a preset.
  app.get("/api/reports/staff-activity", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) return void res.json({ range: null, types: [], totals: { total: 0, byType: {} }, staff: [], detail: [] });

    const preset = String(req.query.preset ?? "month");
    const now = new Date();
    let start: Date;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    if (preset === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (preset === "90d") {
      start = new Date(now); start.setDate(start.getDate() - 90);
    } else if (preset === "year") {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;

    const report = await mod.getStaffActivityReport(orgId, { start, end, staffId });
    res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      types: report.types,
      totals: report.totals,
      staff: report.staff.map(s => ({
        staffId: s.staffId != null ? String(s.staffId) : null,
        name: s.name,
        position: s.position ?? "",
        total: s.total,
        byType: s.byType,
        lastActivity: s.lastActivity ? new Date(s.lastActivity).toISOString() : null,
      })),
      detail: report.detail.map(d => ({
        id: String(d.id),
        type: d.type,
        serviceDate: new Date(d.serviceDate).toISOString().slice(0, 10),
        familyName: d.familyName,
        description: d.description ?? "",
        followUpRequired: d.followUpRequired,
      })),
    });
  });
}

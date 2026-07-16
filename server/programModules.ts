import type { Express, Request, Response } from "express";
import { organizations, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { MODULE_DISABLED_ERR_MSG, userHasModule } from "./_core/modules";
import { getDb, insertAuditLog, getEducationRecords, getChildById } from "./db";
import * as mod from "./moduleDb";
import * as ds from "./disabilityServices";

/**
 * REST mirror of the web tRPC routers, so the native iOS app reaches the same
 * data:
 *   - Lesson Planning   /api/lesson-plans …
 *   - Child Portfolios  /api/portfolio …
 *   - Subsidies         /api/subsidies …
 *   - E-Signatures      /api/digital-documents …
 * All wrap the same server/moduleDb functions as the web.
 */

const LESSON_DOMAINS = new Set(["social_emotional", "language_literacy", "cognition", "physical", "creative_arts", "approaches_to_learning"]);
const DAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);
const DOCUMENT_TYPES = new Set(["enrollment", "consent", "waiver", "health_form", "iep"]);
/** Generic file-library document types (server/moduleDb.ts documents table) — distinct from DOCUMENT_TYPES above, which is the e-sign feature's set. */
const DOCUMENT_LIBRARY_TYPES = new Set(["birth_certificate", "immunization_record", "consent_form", "medical_record", "assessment", "other", "iep", "enrollment"]);

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

  // ---- Digital documents (e-sign) ----
  app.get("/api/digital-documents", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const docs = await mod.getDigitalDocumentsWithFamily(orgId);
    res.json(docs.map(d => ({
      id: String(d.id), familyId: String(d.familyId), familyName: d.familyName,
      documentType: d.documentType, documentUrl: d.documentUrl,
      status: d.status, signedBy: d.signedBy ?? null,
      signedAt: d.signedAt ? new Date(d.signedAt).toISOString() : null,
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 10) : null,
      createdAt: new Date(d.createdAt).toISOString(),
    })));
  });

  app.post("/api/digital-documents", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const familyId = Number(req.body?.familyId);
    const documentType = String(req.body?.documentType ?? "");
    const documentUrl = String(req.body?.documentUrl ?? "").trim();
    if (!familyId || Number.isNaN(familyId) || !DOCUMENT_TYPES.has(documentType) || !documentUrl) {
      return void res.status(400).json({ error: "familyId, documentType, and documentUrl required" });
    }
    if (!(await familyInOrg(familyId, orgId))) return void res.status(403).json({ error: "You don't have access to that family." });
    const result = await mod.createDigitalDocument({
      organizationId: orgId, familyId, documentType: documentType as any, documentUrl,
      expiresAt: localDate(req.body?.expiresAt),
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "digital_document", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    res.json({ success: true, id: result.id });
  });

  app.post("/api/digital-documents/:id/sign", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const id = Number(req.params.id);
    if ((await mod.getRecordOrgId("digitalDocument", id)) !== orgId) return void res.status(404).json({ error: "Not found" });
    const signedBy = String(req.body?.signedBy ?? "").trim();
    if (!signedBy) return void res.status(400).json({ error: "signedBy required" });
    const doc = await mod.getDigitalDocument(id);
    if (!doc) return void res.status(404).json({ error: "Not found" });
    if (doc.status === "signed") return void res.status(409).json({ error: "This document is already signed." });
    if (doc.status === "expired") return void res.status(409).json({ error: "This document has expired and can't be signed." });
    await mod.signDigitalDocument(id, signedBy);
    // Signatures are legally meaningful — always audit who signed what, from where.
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "digital_document", resourceId: String(id), ipAddress: clientIpFromReq(req), detail: `signed_by:${signedBy}` });
    res.json({ success: true });
  });

  // ---- Disability Services (IEP/IFSP, §1302.60–63) — Head Start module ----
  app.get("/api/disability-services", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    if (!(await userHasModule(user, "head_start"))) return void res.status(403).json({ error: MODULE_DISABLED_ERR_MSG });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) return void res.json({ activeEnrollment: 0, childrenWithPlans: 0, pctOfEnrollment: 0, meetsTenPercent: false, expiringSoon: 0, parentRightsPending: 0, records: [] });
    const summary = await ds.getDisabilitySummary(orgId);
    res.json({
      activeEnrollment: summary.activeEnrollment,
      childrenWithPlans: summary.childrenWithPlans,
      pctOfEnrollment: summary.pctOfEnrollment,
      meetsTenPercent: summary.meetsTenPercent,
      expiringSoon: summary.expiringSoon,
      parentRightsPending: summary.parentRightsPending,
      records: summary.records.map(r => ({
        id: String(r.id), childId: String(r.childId), childName: r.childName,
        planType: r.planType, status: r.status,
        primaryDisability: r.primaryDisability ?? null,
        effectiveDate: r.effectiveDate ? new Date(r.effectiveDate).toISOString().slice(0, 10) : null,
        expirationDate: r.expirationDate ? new Date(r.expirationDate).toISOString().slice(0, 10) : null,
        leaAgency: r.leaAgency ?? null, leaContact: r.leaContact ?? null,
        parentRightsNotifiedAt: r.parentRightsNotifiedAt ? new Date(r.parentRightsNotifiedAt).toISOString() : null,
        parentRightsLanguage: r.parentRightsLanguage ?? null,
        transitionChecklist: r.transitionChecklist ?? [],
        notes: r.notes ?? null,
      })),
    });
  });

  app.post("/api/disability-services", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    if (!(await userHasModule(user, "head_start"))) return void res.status(403).json({ error: MODULE_DISABLED_ERR_MSG });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const childId = Number(req.body?.childId);
    const planType = String(req.body?.planType ?? "");
    if (!childId || Number.isNaN(childId) || !["iep", "ifsp", "section_504"].includes(planType)) {
      return void res.status(400).json({ error: "childId and a valid planType required" });
    }
    if (!(await childInOrg(childId, orgId))) return void res.status(403).json({ error: "You don't have access to that child." });
    const id = req.body?.id != null ? Number(req.body.id) : null;
    const status = ["pending_evaluation", "active", "expired", "exited"].includes(req.body?.status) ? req.body.status : undefined;
    try {
      const result = await ds.upsertDisabilityRecord({
        id, organizationId: orgId, childId, planType: planType as any, status,
        primaryDisability: req.body?.primaryDisability ?? undefined,
        effectiveDate: localDate(req.body?.effectiveDate) ?? undefined,
        expirationDate: localDate(req.body?.expirationDate) ?? undefined,
        leaAgency: req.body?.leaAgency ?? undefined,
        leaContact: req.body?.leaContact ?? undefined,
        notes: req.body?.notes ?? undefined,
      });
      await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: id ? "update" : "create", resourceType: "disability_service", resourceId: String(childId), ipAddress: clientIpFromReq(req), detail: planType });
      res.json({ success: true, id: result.id });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Could not save record" });
    }
  });

  app.post("/api/disability-services/:id/parent-rights", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    if (!(await userHasModule(user, "head_start"))) return void res.status(403).json({ error: MODULE_DISABLED_ERR_MSG });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const id = Number(req.params.id);
    if ((await mod.getRecordOrgId("disabilityService", id)) !== orgId) return void res.status(404).json({ error: "Not found" });
    const language = String(req.body?.language ?? "").trim();
    if (!language) return void res.status(400).json({ error: "language required" });
    await ds.markParentRights({ id, organizationId: orgId!, language });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "disability_service", resourceId: String(id), ipAddress: clientIpFromReq(req), detail: "parent_rights" });
    res.json({ success: true });
  });

  app.post("/api/disability-services/:id/transition", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    if (!(await userHasModule(user, "head_start"))) return void res.status(403).json({ error: MODULE_DISABLED_ERR_MSG });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const id = Number(req.params.id);
    if ((await mod.getRecordOrgId("disabilityService", id)) !== orgId) return void res.status(404).json({ error: "Not found" });
    const steps = Array.isArray(req.body?.steps) ? req.body.steps.map(String).slice(0, 10) : [];
    await ds.setTransitionChecklist({ id, organizationId: orgId!, steps });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "disability_service", resourceId: String(id), ipAddress: clientIpFromReq(req), detail: "transition" });
    res.json({ success: true });
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
    // Family-advocate workload is part of the Head Start module (mirrors tRPC familyServices).
    if (!(await userHasModule(user, "head_start"))) return void res.status(403).json({ error: MODULE_DISABLED_ERR_MSG });
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

  // ---- Documents (staff file library — separate from digital-documents e-sign) ----
  app.get("/api/documents", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.json([]);
    const docs = await mod.getDocumentsWithChildNames(orgId);
    res.json(docs.map(d => ({
      id: String(d.id), name: d.fileName, documentType: d.documentType, fileUrl: d.fileUrl,
      mimeType: d.mimeType ?? null, fileSize: d.fileSize ?? null,
      assignedChildId: d.childId != null ? String(d.childId) : null, assignedChildName: d.childName,
      expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0, 10) : null,
      uploadedAt: new Date(d.uploadedAt).toISOString(),
    })));
  });

  app.post("/api/documents", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db); if (orgId == null) return void res.status(400).json({ error: "No organization" });
    const name = String(req.body?.name ?? "").trim();
    const documentType = String(req.body?.documentType ?? "");
    const fileBase64 = String(req.body?.fileBase64 ?? "");
    if (!name || !DOCUMENT_LIBRARY_TYPES.has(documentType) || !fileBase64) {
      return void res.status(400).json({ error: "name, a valid documentType, and fileBase64 are required" });
    }
    const childId = req.body?.childId != null ? Number(req.body.childId) : null;
    if (childId != null && !(await childInOrg(childId, orgId))) {
      return void res.status(403).json({ error: "You don't have access to that child." });
    }
    const uploadedBy = await mod.resolveStaffId(orgId, user.id);
    if (uploadedBy == null) return void res.status(400).json({ error: "No staff record found for your account — ask an admin to add one." });
    try {
      const { saveBase64File } = await import("./fileStorage");
      const saved = saveBase64File(`org-${orgId}`, name, fileBase64);
      const result = await mod.createDocument({
        organizationId: orgId, childId, documentType: documentType as any,
        fileName: name, fileUrl: saved.url, fileSize: saved.sizeBytes,
        mimeType: req.body?.mimeType || null, expiryDate: localDate(req.body?.expiryDate),
        uploadedBy,
      });
      await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "document", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
      res.json({
        id: String(result.id), name, documentType, fileUrl: saved.url,
        mimeType: req.body?.mimeType ?? null, fileSize: saved.sizeBytes,
        assignedChildId: childId != null ? String(childId) : null, assignedChildName: null,
        expiryDate: req.body?.expiryDate ?? null, uploadedAt: new Date().toISOString(),
      });
    } catch (e) {
      // drizzle/mysql2 errors put the actual DB message on `.cause`, not
      // `.message` (which is just "Failed query: ...\nparams: ..."). Surface
      // it so failures like a pending migration are debuggable from the response.
      const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : null;
      const message = cause ?? (e instanceof Error ? e.message : "Could not save file");
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/documents/:id/assign", async (req, res) => {
    const user = await requireStaff(req); if (!user) return void res.status(401).json({ error: "Please sign in again" });
    const db = await getDb(); if (!db) return void res.status(500).json({ error: "Database not available" });
    const orgId = await resolveOrgId(user, db);
    const id = Number(req.params.id);
    if ((await mod.getRecordOrgId("document", id)) !== orgId || orgId == null) return void res.status(404).json({ error: "Not found" });
    const childId = Number(req.body?.childId);
    if (!childId || !(await childInOrg(childId, orgId))) return void res.status(403).json({ error: "You don't have access to that child." });
    await mod.assignDocumentToChild(id, orgId, childId);
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "document", resourceId: String(id), ipAddress: clientIpFromReq(req), detail: `assigned:${childId}` });
    res.json({ success: true });
  });
}

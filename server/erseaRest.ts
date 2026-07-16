import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { userHasModule } from "./_core/modules";
import { getDb, insertAuditLog } from "./db";
import * as mod from "./moduleDb";
import { listIncidents, createIncident } from "./suspensionLog";
import { eligibilityRecords, suspensionExpulsionLogs, type User } from "../drizzle/schema";

/**
 * REST mirror of ERSEA (Eligibility, Recruitment, Selection, Enrollment,
 * Attendance — Head Start §1302.12-14, §1302.17) for the native iOS app.
 * Paths match what ios/Sources/Networking/APIClient.swift already expects.
 * Head Start-gated, same pattern as familyCaseManagementRest.ts.
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin" && user.role !== "staff") return null;
    return (await userHasModule(user, "head_start")) ? user : null;
  } catch {
    return null;
  }
}

function reject(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

// ---- Eligibility record <-> iOS EligibilityRecord shape ----

function eligibilityToIos(row: typeof eligibilityRecords.$inferSelect) {
  return {
    id: String(row.id),
    childName: row.childName,
    childDateOfBirth: row.childDateOfBirth,
    familyId: row.familyId != null ? String(row.familyId) : null,
    applicationDate: row.applicationDate,
    householdSize: row.householdSize,
    annualIncome: Math.round(row.annualIncomeCents / 100),
    incomeSource: row.incomeSource ?? "",
    categoricalEligibility: row.categoricalEligibility,
    priorityScore: row.priorityScore,
    riskFactors: row.riskFactors ?? [],
    status: row.status,
    enrolledDate: row.enrolledDate,
    classroom: row.classroom,
    waitlistPosition: row.waitlistPosition,
    notes: row.notes ?? "",
  };
}

/** Validates + extracts the mutable fields shared by create/update. Returns
 * null (and writes the 400 response itself) if required fields are missing. */
function parseEligibilityBody(req: Request, res: Response) {
  const childName = String(req.body?.childName ?? "").trim();
  const childDateOfBirth = req.body?.childDateOfBirth ? new Date(req.body.childDateOfBirth) : null;
  const applicationDate = req.body?.applicationDate ? new Date(req.body.applicationDate) : null;
  const householdSize = Number(req.body?.householdSize);
  const annualIncome = Number(req.body?.annualIncome);
  if (!childName || !childDateOfBirth || !applicationDate || !Number.isFinite(householdSize) || !Number.isFinite(annualIncome)) {
    reject(res, 400, "childName, childDateOfBirth, applicationDate, householdSize, and annualIncome are required");
    return null;
  }
  const familyId = req.body?.familyId != null && String(req.body.familyId).trim() !== "" ? Number(req.body.familyId) : null;
  return {
    childName,
    childDateOfBirth,
    familyId: familyId != null && Number.isFinite(familyId) ? familyId : null,
    applicationDate,
    householdSize,
    annualIncomeCents: Math.round(annualIncome * 100),
    incomeSource: req.body?.incomeSource != null ? String(req.body.incomeSource) : null,
    categoricalEligibility: String(req.body?.categoricalEligibility ?? "None (income-based)"),
    priorityScore: Number.isFinite(Number(req.body?.priorityScore)) ? Number(req.body.priorityScore) : 0,
    riskFactors: Array.isArray(req.body?.riskFactors) ? req.body.riskFactors.map(String) : [],
    status: String(req.body?.status ?? "Pending Review"),
    enrolledDate: req.body?.enrolledDate ? new Date(req.body.enrolledDate) : null,
    classroom: req.body?.classroom != null ? String(req.body.classroom) : null,
    waitlistPosition: req.body?.waitlistPosition != null && Number.isFinite(Number(req.body.waitlistPosition))
      ? Number(req.body.waitlistPosition)
      : null,
    notes: req.body?.notes != null ? String(req.body.notes) : "",
  };
}

// ---- Suspension/expulsion log <-> iOS SuspensionExpulsionLog shape ----

function suspensionToIos(row: typeof suspensionExpulsionLogs.$inferSelect & { childName: string }) {
  return {
    id: String(row.id),
    childId: String(row.childId),
    childName: row.childName,
    incidentDate: row.incidentDate,
    incidentType: row.incidentTypeDetail ?? "Internal Review Only",
    behaviorDescription: row.description,
    mentalHealthConsultRequested: row.mentalHealthConsultDate != null,
    mentalHealthConsultDate: row.mentalHealthConsultDate,
    familyMeetingHeld: row.familyMeetingDate != null,
    familyMeetingDate: row.familyMeetingDate,
    behaviourSupportPlanCreated: row.behaviourSupportPlanDate != null,
    behaviourSupportPlanDate: row.behaviourSupportPlanDate,
    stateAgencyNotified: row.stateAgencyNotified === 1,
    stateNotificationDate: row.stateNotificationDate,
    outcome: row.outcome ?? "Pending Resolution",
    resolutionDate: row.resolvedAt,
    notes: row.description,
  };
}

export function registerErseaRoutes(app: Express) {
  // ---- Eligibility ----
  app.get("/api/ersea/eligibility", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");
    const rows = await db
      .select()
      .from(eligibilityRecords)
      .where(eq(eligibilityRecords.organizationId, orgId))
      .orderBy(desc(eligibilityRecords.applicationDate));
    res.json(rows.map(eligibilityToIos));
  });

  app.post("/api/ersea/eligibility", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");
    const fields = parseEligibilityBody(req, res);
    if (!fields) return;
    const recordedBy = await mod.resolveStaffId(orgId, user.id);
    const [result] = await db.insert(eligibilityRecords).values({
      organizationId: orgId,
      ...fields,
      recordedBy: recordedBy ?? undefined,
    });
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "eligibility_record",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  app.post("/api/ersea/eligibility/:id", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");
    const id = Number(req.params.id);
    if (!id) return reject(res, 400, "Invalid id");
    const [existing] = await db
      .select({ id: eligibilityRecords.id })
      .from(eligibilityRecords)
      .where(and(eq(eligibilityRecords.id, id), eq(eligibilityRecords.organizationId, orgId)))
      .limit(1);
    if (!existing) return reject(res, 404, "Not found");
    const fields = parseEligibilityBody(req, res);
    if (!fields) return;
    await db
      .update(eligibilityRecords)
      .set(fields)
      .where(and(eq(eligibilityRecords.id, id), eq(eligibilityRecords.organizationId, orgId)));
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "eligibility_record",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  // ---- Suspension / Expulsion logs ----
  app.get("/api/ersea/suspensions", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const rows = await listIncidents(orgId);
    res.json(rows.map(suspensionToIos));
  });

  app.post("/api/ersea/suspensions", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");
    const childId = Number(req.body?.childId);
    const behaviorDescription = String(req.body?.behaviorDescription ?? req.body?.notes ?? "").trim();
    const incidentDate = req.body?.incidentDate ? new Date(req.body.incidentDate) : new Date();
    if (!childId || !behaviorDescription) {
      return reject(res, 400, "childId and behaviorDescription are required");
    }
    let created: { id: number };
    try {
      created = await createIncident({
        organizationId: orgId,
        childId,
        incidentDate,
        type: "temporary_suspension",
        description: behaviorDescription,
        stepsTaken: [],
        outcome: req.body?.outcome ? String(req.body.outcome) : null,
      });
    } catch (e) {
      return reject(res, 404, e instanceof Error ? e.message : "Child not found in this organization");
    }

    const mentalHealthConsultDate = req.body?.mentalHealthConsultDate ? new Date(req.body.mentalHealthConsultDate) : null;
    const familyMeetingDate = req.body?.familyMeetingDate ? new Date(req.body.familyMeetingDate) : null;
    const behaviourSupportPlanDate = req.body?.behaviourSupportPlanDate ? new Date(req.body.behaviourSupportPlanDate) : null;
    const stateNotificationDate = req.body?.stateNotificationDate ? new Date(req.body.stateNotificationDate) : null;
    await db
      .update(suspensionExpulsionLogs)
      .set({
        incidentTypeDetail: req.body?.incidentType != null ? String(req.body.incidentType) : null,
        mentalHealthConsultDate,
        familyMeetingDate,
        behaviourSupportPlanDate,
        stateAgencyNotified: req.body?.stateAgencyNotified ? 1 : 0,
        stateNotificationDate,
        ...(req.body?.resolutionDate ? { resolvedAt: new Date(req.body.resolutionDate) } : {}),
      })
      .where(and(eq(suspensionExpulsionLogs.id, created.id), eq(suspensionExpulsionLogs.organizationId, orgId)));

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "suspension_expulsion_log",
      resourceId: String(created.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

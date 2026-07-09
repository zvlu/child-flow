import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { MODULE_DISABLED_ERR_MSG, userHasModule } from "./_core/modules";
import { getDb, insertAuditLog, createFamilyService, getOrganizationChildren } from "./db";
import * as mod from "./moduleDb";
import * as fcm from "./familyCaseManagement";
import * as ap from "./attendancePlans";
import { getFpaDetail, upsertFpa } from "./fpaDb";
import type { User } from "../drizzle/schema";

/**
 * REST mirror of the family case-management tRPC routers (familyGoals,
 * familyReferrals, familyHomeVisits, fna, cfcr, familyCaseNotes, fpa,
 * familyServices.contacts) for the native iOS app. All Head Start-gated.
 * Paths match what ios/Sources/Networking/APIClient.swift already expects,
 * since those calls predate this file and previously 404'd.
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

function orgOf(user: User): number | null {
  return user.organizationId;
}

function reject(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

/** DB snake_case type -> iOS MonthlyContact.ContactType raw string. Rows whose
 * type has no iOS contact equivalent (office_visit, referral, monthly_contact,
 * other — referrals have their own dedicated feature) are omitted. */
const CONTACT_TYPE_TO_IOS: Record<string, string> = {
  phone_call: "Phone Call",
  in_person: "In Person",
  text: "Text Message",
  zoom: "Zoom/Video",
  voicemail: "Voicemail Attempt",
  home_visit: "Home Visit",
  email: "Email",
  coordinated_services: "Coordinated Services",
};
const CONTACT_TYPE_FROM_IOS: Record<string, string> = Object.fromEntries(
  Object.entries(CONTACT_TYPE_TO_IOS).map(([db, ios]) => [ios, db]),
);

const REFERRAL_SERVICE_TYPES = new Set([
  "housing", "food_assistance", "mental_health", "substance_use", "domestic_violence",
  "legal_aid", "employment", "adult_education", "childcare", "medical_care",
  "dental_care", "vision_care", "transportation", "utility_assistance",
  "financial_counseling", "other",
]);
const REFERRAL_SERVICE_TO_IOS: Record<string, string> = {
  housing: "Housing Assistance", food_assistance: "Food Assistance", mental_health: "Mental Health Services",
  substance_use: "Substance Use Support", domestic_violence: "Domestic Violence Services", legal_aid: "Legal Aid",
  employment: "Employment Services", adult_education: "Adult Education / GED", childcare: "Additional Childcare",
  medical_care: "Medical Care", dental_care: "Dental Care", vision_care: "Vision Care",
  transportation: "Transportation", utility_assistance: "Utility Assistance",
  financial_counseling: "Financial Counseling", other: "Other",
};
const REFERRAL_SERVICE_FROM_IOS: Record<string, string> = Object.fromEntries(
  Object.entries(REFERRAL_SERVICE_TO_IOS).map(([db, ios]) => [ios, db]),
);
const REFERRAL_STATUS_TO_IOS: Record<string, string> = {
  pending: "Pending", contacted: "Contacted", enrolled: "Enrolled / Receiving",
  declined: "Declined by Family", unavailable: "Service Unavailable", completed: "Completed",
};
const REFERRAL_STATUS_FROM_IOS: Record<string, string> = Object.fromEntries(
  Object.entries(REFERRAL_STATUS_TO_IOS).map(([db, ios]) => [ios, db]),
);

const VISIT_TYPE_TO_IOS: Record<string, string> = {
  home_visit: "Home Visit", office_visit: "Office Visit", phone_call: "Phone Call",
  group_social: "Group Socialization", community_event: "Community Event",
};
const VISIT_TYPE_FROM_IOS: Record<string, string> = Object.fromEntries(
  Object.entries(VISIT_TYPE_TO_IOS).map(([db, ios]) => [ios, db]),
);

const GOAL_STATUS_TO_IOS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", completed: "Completed", on_hold: "On Hold",
};
const GOAL_CATEGORY_LABELS = new Set([
  "Education", "Employment", "Housing", "Health", "Child Development", "Family Well-Being", "Community Support", "Other",
]);

const FNA_DOMAIN_TO_IOS: Record<string, string> = {
  familySafety: "Family Safety", familyHealth: "Family Health", familyLearning: "Family Learning",
  familyEngagement: "Family Engagement", familyWellbeing: "Family Well-Being", communityConnections: "Community Connections",
};

const CASE_NOTE_TYPE_TO_IOS: Record<string, string> = {
  home_visit: "Home Visit", phone_call: "Phone Call", office_visit: "Office Visit", incident: "Incident", general: "General",
};
const CASE_NOTE_TYPE_FROM_IOS: Record<string, string> = Object.fromEntries(
  Object.entries(CASE_NOTE_TYPE_TO_IOS).map(([db, ios]) => [ios, db]),
);

/** "child-42" or "42" -> 42; also tolerates a bare numeric id. */
function parseChildId(raw: unknown): number | null {
  const s = String(raw ?? "");
  const n = Number(s.replace(/^child-/, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerFamilyCaseManagementRoutes(app: Express) {
  // ---- Contacts (subset of the general family_services log) ----
  app.get("/api/families/:familyId/contacts", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const rows = await fcm.getFamilyContacts(familyId);
    res.json(
      rows
        .filter((r) => r.type in CONTACT_TYPE_TO_IOS)
        .map((r) => ({
          id: String(r.id), familyId: String(r.familyId), familyName: "",
          date: r.serviceDate.toISOString(), contactType: CONTACT_TYPE_TO_IOS[r.type],
          contactedBy: r.contactedByName, notes: r.description,
          followUpNeeded: r.followUpRequired === 1, followUpDate: r.followUpDate ? r.followUpDate.toISOString() : null,
        })),
    );
  });

  app.post("/api/families/contacts", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.body?.familyId);
    const iosType = String(req.body?.contactType ?? "");
    const dbType = CONTACT_TYPE_FROM_IOS[iosType];
    if (!familyId || !dbType) return reject(res, 400, "familyId and a valid contactType are required");
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const recordedBy = await mod.resolveStaffId(orgId, user.id);
    const date = req.body?.date ? new Date(req.body.date) : new Date();
    const [result] = await createFamilyService({
      organizationId: orgId, familyId, type: dbType as any, serviceDate: date,
      description: String(req.body?.notes ?? ""), followUpRequired: req.body?.followUpNeeded ? 1 : 0,
      followUpDate: req.body?.followUpDate ? new Date(req.body.followUpDate) : null,
      recordedBy: recordedBy ?? undefined,
    } as any);
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "family_service", resourceId: String(familyId), ipAddress: clientIpFromReq(req) });
    res.json({
      id: String((result as any)?.insertId ?? ""), familyId: String(familyId), familyName: "",
      date: date.toISOString(), contactType: iosType, contactedBy: "You", notes: req.body?.notes ?? "",
      followUpNeeded: !!req.body?.followUpNeeded, followUpDate: req.body?.followUpDate ?? null,
    });
  });

  // ---- Family Partnership Agreement (FPA) ----
  const fpaJson = async (orgId: number, familyId: number) => {
    const detail = await getFpaDetail(orgId, familyId);
    if (!detail) return null;
    const a = detail.agreement;
    const statusMap: Record<string, string> = { draft: "Not Started", active: "Active", review_due: "Needs Review", completed: "Active", expired: "Needs Review" };
    return {
      id: a ? String(a.id) : `pending-${familyId}`,
      familyId: String(familyId),
      familyName: detail.familyName,
      completedDate: a?.status === "completed" ? a.updatedAt.toISOString() : null,
      reviewDate: a?.reviewDate ? new Date(a.reviewDate).toISOString() : null,
      familyAdvocate: "Unassigned",
      status: a ? (statusMap[a.status] ?? "Not Started") : "Not Started",
      parentSigned: a?.parentSigned === 1,
      staffSigned: a?.staffSigned === 1,
    };
  };

  app.get("/api/families/:familyId/fpa", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 404, "No organization");
    const familyId = Number(req.params.familyId);
    const json = await fpaJson(orgId, familyId);
    if (!json) return reject(res, 404, "Not found");
    res.json(json);
  });

  app.post("/api/families/fpa", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.body?.familyId);
    if (!familyId) return reject(res, 400, "familyId required");
    try {
      await upsertFpa({ organizationId: orgId, familyId, status: "draft" });
      const json = await fpaJson(orgId, familyId);
      res.json(json);
    } catch (e) {
      reject(res, 400, e instanceof Error ? e.message : "Could not create agreement");
    }
  });

  app.post("/api/families/:familyId/fpa/update", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.params.familyId);
    const statusFromIos: Record<string, "draft" | "active" | "review_due" | "completed" | "expired"> = {
      "Not Started": "draft", "In Progress": "active", "Active": "active", "Needs Review": "review_due",
    };
    try {
      await upsertFpa({
        organizationId: orgId, familyId,
        status: req.body?.status ? statusFromIos[req.body.status] : undefined,
        reviewDate: req.body?.reviewDate ? new Date(req.body.reviewDate) : undefined,
        parentSigned: typeof req.body?.parentSigned === "boolean" ? req.body.parentSigned : undefined,
        staffSigned: typeof req.body?.staffSigned === "boolean" ? req.body.staffSigned : undefined,
      });
      await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "fpa", resourceId: String(familyId), ipAddress: clientIpFromReq(req) });
      res.json({ success: true });
    } catch (e) {
      reject(res, 400, e instanceof Error ? e.message : "Could not update agreement");
    }
  });

  // ---- Referrals ----
  app.get("/api/families/:familyId/referrals", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const rows = await fcm.getFamilyReferrals(familyId);
    res.json(rows.map((r) => ({
      id: String(r.id), familyId: String(r.familyId), agencyName: r.agencyName,
      serviceType: REFERRAL_SERVICE_TO_IOS[r.serviceType] ?? "Other",
      referredBy: "Staff", referralDate: r.referralDate.toISOString(),
      followUpDate: r.followUpDate ? r.followUpDate.toISOString() : null,
      status: REFERRAL_STATUS_TO_IOS[r.status] ?? "Pending",
      notes: r.notes ?? "", outcomeNotes: r.outcomeNotes ?? "",
    })));
  });

  app.post("/api/families/:familyId/referrals", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const dbServiceType = REFERRAL_SERVICE_FROM_IOS[String(req.body?.serviceType ?? "")];
    const agencyName = String(req.body?.agencyName ?? "").trim();
    if (!agencyName || !dbServiceType) return reject(res, 400, "agencyName and a valid serviceType are required");
    const referredBy = await mod.resolveStaffId(orgId, user.id);
    const result = await fcm.createFamilyReferral({
      organizationId: orgId, familyId, agencyName,
      serviceType: dbServiceType as any,
      referralDate: req.body?.referralDate ? new Date(req.body.referralDate) : new Date(),
      followUpDate: req.body?.followUpDate ? new Date(req.body.followUpDate) : undefined,
      notes: req.body?.notes ?? undefined, referredBy: referredBy ?? undefined,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "family_referral", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    res.json({ success: true });
  });

  app.post("/api/families/:familyId/referrals/:id", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const id = Number(req.params.id);
    if ((await mod.getRecordOrgId("familyReferral", id)) !== orgId) return reject(res, 404, "Not found");
    const patch: Record<string, unknown> = {};
    if (req.body?.status) patch.status = REFERRAL_STATUS_FROM_IOS[req.body.status] ?? undefined;
    if (req.body?.followUpDate !== undefined) patch.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : null;
    if (typeof req.body?.notes === "string") patch.notes = req.body.notes;
    if (typeof req.body?.outcomeNotes === "string") patch.outcomeNotes = req.body.outcomeNotes;
    await fcm.updateFamilyReferral(id, orgId, patch as any);
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "family_referral", resourceId: String(id), ipAddress: clientIpFromReq(req) });
    res.json({ success: true });
  });

  // ---- Home Visit Logs ----
  app.get("/api/families/:familyId/visits", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const rows = await fcm.getFamilyHomeVisits(familyId);
    res.json(rows.map((r) => ({
      id: String(r.id), familyId: String(r.familyId), visitDate: r.visitDate.toISOString(),
      visitType: VISIT_TYPE_TO_IOS[r.visitType] ?? "Home Visit", durationMinutes: r.durationMinutes,
      conductedBy: "Staff", topicsCovered: r.topicsCovered ?? [], notes: r.notes ?? "",
      goalsMentioned: r.goalsMentioned ?? [], locationVerified: r.locationVerified === 1,
    })));
  });

  app.post("/api/families/:familyId/visits", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const dbVisitType = VISIT_TYPE_FROM_IOS[String(req.body?.visitType ?? "")] ?? "home_visit";
    const conductedBy = await mod.resolveStaffId(orgId, user.id);
    const result = await fcm.createFamilyHomeVisit({
      organizationId: orgId, familyId,
      visitDate: req.body?.visitDate ? new Date(req.body.visitDate) : new Date(),
      visitType: dbVisitType as any, durationMinutes: Number(req.body?.durationMinutes ?? 0),
      topicsCovered: Array.isArray(req.body?.topicsCovered) ? req.body.topicsCovered.map(String) : [],
      notes: req.body?.notes ?? undefined,
      goalsMentioned: Array.isArray(req.body?.goalsMentioned) ? req.body.goalsMentioned.map(String) : [],
      locationVerified: req.body?.locationVerified ? 1 : 0, conductedBy: conductedBy ?? undefined,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "family_home_visit", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    res.json({ success: true });
  });

  // ---- Family Goals ----
  app.get("/api/families/:familyId/goals", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const rows = await fcm.getFamilyGoals(familyId);
    res.json(rows.map((g) => ({
      id: String(g.id), familyId: String(g.familyId), title: g.title, description: g.description ?? "",
      category: GOAL_CATEGORY_LABELS.has(g.category ?? "") ? g.category : "Other",
      status: GOAL_STATUS_TO_IOS[g.status] ?? "Not Started",
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      completedDate: g.completedDate ? g.completedDate.toISOString() : null,
      steps: (g.steps ?? []).map((s) => ({ id: s.id, title: s.title, isCompleted: s.isCompleted, dueDate: s.dueDate, notes: s.notes })),
      createdDate: g.createdAt.toISOString(),
    })));
  });

  app.post("/api/families/goals", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.body?.familyId);
    const title = String(req.body?.title ?? "").trim();
    if (!familyId || !title) return reject(res, 400, "familyId and title are required");
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const steps = Array.isArray(req.body?.steps)
      ? req.body.steps.map((title: string) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: String(title), isCompleted: false, dueDate: null, notes: null }))
      : [];
    const result = await fcm.createFamilyGoal({
      organizationId: orgId, familyId, title,
      description: req.body?.description ?? undefined, category: req.body?.category ?? undefined,
      targetDate: req.body?.targetDate ? new Date(req.body.targetDate) : undefined, steps,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "family_goal", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    const [row] = await fcm.getFamilyGoals(familyId);
    res.json(row
      ? { id: String(row.id), familyId: String(row.familyId), title: row.title, description: row.description ?? "", category: row.category ?? "Other", status: GOAL_STATUS_TO_IOS[row.status] ?? "Not Started", targetDate: row.targetDate?.toISOString() ?? null, completedDate: null, steps: row.steps ?? [], createdDate: row.createdAt.toISOString() }
      : { id: String(result.id), familyId: String(familyId), title, description: "", category: "Other", status: "Not Started", targetDate: null, completedDate: null, steps: [], createdDate: new Date().toISOString() });
  });

  app.post("/api/families/goals/:goalId/steps/:stepId", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const goalId = Number(req.params.goalId);
    if ((await mod.getRecordOrgId("familyGoal", goalId)) !== orgId) return reject(res, 404, "Not found");
    await fcm.updateGoalStep(goalId, req.params.stepId, !!req.body?.completed);
    res.json({ success: true });
  });

  // ---- Family Needs Assessment (FNA) ----
  app.get("/api/families/:familyId/fna", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 404, "No organization");
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const db = await getDb(); if (!db) return reject(res, 500, "Database not available");
    const fna = await fcm.getFamilyNeedsAssessment(familyId);
    if (!fna) return reject(res, 404, "No assessment on file yet");
    res.json({
      id: String(fna.id), familyId: String(fna.familyId), familyName: "",
      conductedBy: "Staff", conductedDate: fna.conductedDate.toISOString(),
      reviewDate: fna.reviewDate ? fna.reviewDate.toISOString() : null,
      ratings: fna.ratings.map((r) => ({ id: r.id, domain: r.domain, level: r.level, notes: r.notes })),
      notes: fna.notes ?? "", isComplete: fna.isComplete === 1,
    });
  });

  app.post("/api/families/fna", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.body?.familyId);
    if (!familyId) return reject(res, 400, "familyId required");
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const ratings = Array.isArray(req.body?.ratings) ? req.body.ratings : [];
    const conductedBy = await mod.resolveStaffId(orgId, user.id);
    const result = await fcm.saveFamilyNeedsAssessment({
      organizationId: orgId, familyId, conductedBy,
      ratings: ratings.map((r: any) => ({ id: String(r.id ?? ""), domain: String(r.domain ?? ""), level: Number(r.level ?? 1), notes: String(r.notes ?? "") })),
      notes: String(req.body?.notes ?? ""), isComplete: ratings.length > 0,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "family_needs_assessment", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    const fna = await fcm.getFamilyNeedsAssessment(familyId);
    res.json(fna ? {
      id: String(fna.id), familyId: String(fna.familyId), familyName: "",
      conductedBy: "Staff", conductedDate: fna.conductedDate.toISOString(),
      reviewDate: fna.reviewDate ? fna.reviewDate.toISOString() : null,
      ratings: fna.ratings, notes: fna.notes ?? "", isComplete: fna.isComplete === 1,
    } : null);
  });

  // ---- CFCR (Child & Family Case Review) ----
  app.get("/api/children/:childId/cfcr", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const childId = parseChildId(req.params.childId);
    if (!childId || !(await fcm.childBelongsToOrg(childId, orgId))) return reject(res, 403, "You don't have access to that child.");
    const rows = await fcm.getCfcrRecords(childId);
    res.json(rows.map((r) => ({
      id: String(r.id), childId: String(r.childId), childName: "", classroom: "",
      meetingDate: r.meetingDate.toISOString(), participants: r.participants ?? [],
      attendanceNotes: r.attendanceNotes ?? "", healthNotes: r.healthNotes ?? "",
      behaviorNotes: r.behaviorNotes ?? "", developmentalNotes: r.developmentalNotes ?? "",
      familyGoalNotes: r.familyGoalNotes ?? "", actionItems: r.actionItems ?? [], conductedBy: "Staff",
    })));
  });

  app.post("/api/children/cfcr", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const childId = parseChildId(req.body?.childId);
    if (!childId || !(await fcm.childBelongsToOrg(childId, orgId))) return reject(res, 403, "You don't have access to that child.");
    const conductedBy = await mod.resolveStaffId(orgId, user.id);
    const result = await fcm.createCfcrRecord({
      organizationId: orgId, childId,
      meetingDate: req.body?.meetingDate ? new Date(req.body.meetingDate) : new Date(),
      attendanceNotes: req.body?.attendanceNotes ?? undefined, healthNotes: req.body?.healthNotes ?? undefined,
      behaviorNotes: req.body?.behaviorNotes ?? undefined, developmentalNotes: req.body?.developmentalNotes ?? undefined,
      familyGoalNotes: req.body?.familyGoalNotes ?? undefined, participants: [], actionItems: [],
      conductedBy: conductedBy ?? undefined,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "cfcr_record", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    const [row] = await fcm.getCfcrRecords(childId);
    res.json(row ? {
      id: String(row.id), childId: String(row.childId), childName: "", classroom: "",
      meetingDate: row.meetingDate.toISOString(), participants: [],
      attendanceNotes: row.attendanceNotes ?? "", healthNotes: row.healthNotes ?? "",
      behaviorNotes: row.behaviorNotes ?? "", developmentalNotes: row.developmentalNotes ?? "",
      familyGoalNotes: row.familyGoalNotes ?? "", actionItems: [], conductedBy: "Staff",
    } : { id: String(result.id), childId: String(childId), childName: "", classroom: "", meetingDate: new Date().toISOString(), participants: [], attendanceNotes: "", healthNotes: "", behaviorNotes: "", developmentalNotes: "", familyGoalNotes: "", actionItems: [], conductedBy: "Staff" });
  });

  // ---- Family Case Notes ----
  app.get("/api/families/:familyId/notes", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const rows = await fcm.getFamilyCaseNotes(familyId);
    res.json(rows.map((n) => ({
      id: String(n.id), familyId: String(n.familyId), authorId: n.authorId != null ? String(n.authorId) : "",
      authorName: n.authorName, type: CASE_NOTE_TYPE_TO_IOS[n.type] ?? "General",
      confidentiality: n.confidentiality === "sensitive" ? "Sensitive" : "Standard",
      body: n.body, createdAt: n.createdAt.toISOString(),
      followUpRequired: n.followUpRequired === 1, followUpDue: n.followUpDue ? n.followUpDue.toISOString() : null,
      followUpCompleted: n.followUpCompleted === 1,
    })));
  });

  app.post("/api/families/:familyId/notes", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const familyId = Number(req.params.familyId);
    if (!(await fcm.familyBelongsToOrg(familyId, orgId))) return reject(res, 403, "You don't have access to that family.");
    const body = String(req.body?.body ?? "").trim();
    const dbType = CASE_NOTE_TYPE_FROM_IOS[String(req.body?.type ?? "")] ?? "general";
    if (!body) return reject(res, 400, "body is required");
    const authorId = await mod.resolveStaffId(orgId, user.id);
    const result = await fcm.createFamilyCaseNote({
      organizationId: orgId, familyId, type: dbType as any,
      confidentiality: req.body?.confidentiality === "Sensitive" ? "sensitive" : "standard",
      body, followUpRequired: req.body?.followUpRequired ? 1 : 0,
      followUpDue: req.body?.followUpDue ? new Date(req.body.followUpDue) : undefined,
      authorId: authorId ?? undefined,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "family_case_note", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    const [row] = await fcm.getFamilyCaseNotes(familyId);
    res.json(row ? {
      id: String(row.id), familyId: String(row.familyId), authorId: row.authorId != null ? String(row.authorId) : "",
      authorName: row.authorName, type: CASE_NOTE_TYPE_TO_IOS[row.type] ?? "General",
      confidentiality: row.confidentiality === "sensitive" ? "Sensitive" : "Standard",
      body: row.body, createdAt: row.createdAt.toISOString(),
      followUpRequired: row.followUpRequired === 1, followUpDue: row.followUpDue ? row.followUpDue.toISOString() : null,
      followUpCompleted: row.followUpCompleted === 1,
    } : null);
  });

  app.post("/api/notes/:noteId/followup", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const id = Number(req.params.noteId);
    const row = await fcm.setCaseNoteFollowUpCompleted(id, orgId, !!req.body?.completed);
    if (!row) return reject(res, 404, "Not found");
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "update", resourceType: "family_case_note", resourceId: String(id), ipAddress: clientIpFromReq(req), detail: "followup" });
    res.json({
      id: String(row.id), familyId: String(row.familyId), authorId: row.authorId != null ? String(row.authorId) : "",
      authorName: "", type: CASE_NOTE_TYPE_TO_IOS[row.type] ?? "General",
      confidentiality: row.confidentiality === "sensitive" ? "Sensitive" : "Standard",
      body: row.body, createdAt: row.createdAt.toISOString(),
      followUpRequired: row.followUpRequired === 1, followUpDue: row.followUpDue ? row.followUpDue.toISOString() : null,
      followUpCompleted: row.followUpCompleted === 1,
    });
  });

  // ---- Attendance Improvement Plans (AIP) ----
  app.get("/api/attendance/plans", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const rows = await ap.getAttendancePlans(orgId);
    res.json(rows.map((p) => ({
      id: String(p.id), childId: String(p.childId), childName: p.childName, classroom: "",
      currentAttendanceRate: 0, createdDate: p.createdDate.toISOString(),
      reviewDate: p.reviewDate ? p.reviewDate.toISOString() : null,
      familyAdvocate: p.familyAdvocateName,
      barriers: p.barriers ?? [], strategies: p.strategies ?? [],
      status: p.status === "active" ? "Active" : p.status === "resolved" ? "Resolved" : "Closed",
    })));
  });

  app.post("/api/attendance/plans", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb(); if (!db) return reject(res, 500, "Database not available");

    // childId is normally a real numeric id (from a ChronicAbsenceAlert), but
    // the standalone "New Plan" form generates a random UUID with no real
    // child selected — fall back to matching childName within the org.
    let childId = parseChildId(req.body?.childId);
    if (!childId && typeof req.body?.childName === "string" && req.body.childName.trim()) {
      const kids = await getOrganizationChildren(orgId);
      const match = kids.find((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(req.body.childName.toLowerCase()));
      childId = match?.id ?? null;
    }
    if (!childId || !(await fcm.childBelongsToOrg(childId, orgId))) {
      return reject(res, 400, "Could not match childId/childName to a child in your program.");
    }
    const familyAdvocate = await mod.resolveStaffId(orgId, user.id);
    const strategies = Array.isArray(req.body?.strategies)
      ? req.body.strategies.map((s: any) => ({ id: String(s?.id ?? `${Date.now()}`), description: String(s?.description ?? ""), isImplemented: !!s?.isImplemented, targetDate: s?.targetDate ?? null }))
      : [];
    const result = await ap.createAttendancePlan({
      organizationId: orgId, childId, familyAdvocate: familyAdvocate ?? undefined,
      reviewDate: req.body?.reviewDate ? new Date(req.body.reviewDate) : undefined,
      barriers: Array.isArray(req.body?.barriers) ? req.body.barriers.map(String) : [],
      strategies, status: "active", notes: req.body?.notes ?? undefined,
    });
    await insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "create", resourceType: "attendance_plan", resourceId: String(result.id), ipAddress: clientIpFromReq(req) });
    res.json({ success: true });
  });

  // ---- Chronic Absence Alerts ----
  app.get("/api/attendance/chronic-absence", async (req: Request, res: Response) => {
    const user = await requireStaff(req); if (!user) return reject(res, 401, "Please sign in again");
    const orgId = orgOf(user); if (orgId == null) return void res.json([]);
    const { getChronicAbsenceSummary } = await import("./chronicAbsence");
    const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 30;
    const summary = await getChronicAbsenceSummary(orgId, windowDays);
    const advocateByChild = await ap.getAttendancePlans(orgId);
    const advocateMap = new Map(advocateByChild.map((p) => [p.childId, p.familyAdvocateName]));
    res.json(summary.alerts.map((a) => ({
      childId: String(a.childId), childName: a.childName, familyId: a.familyId != null ? String(a.familyId) : "",
      classroom: "", familyAdvocate: advocateMap.get(a.childId) ?? "Unassigned",
      totalDaysEnrolled: a.totalDays, totalDaysPresent: a.presentDays,
      totalDaysAbsent: a.absentDays, unexcusedAbsences: a.absentDays, excusedAbsences: a.excusedDays,
      weeklyRates: a.weeklyTrend.map((w) => w.rate / 100),
      hasAIP: advocateByChild.some((p) => p.childId === a.childId && p.status === "active"),
      lastOutreachDate: a.lastAbsence,
      consecutiveAbsences: 0,
      notes: "",
    })));
  });
}

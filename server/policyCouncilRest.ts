import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { userHasModule } from "./_core/modules";
import { insertAuditLog } from "./db";
import * as pc from "./policyCouncil";
import type { PolicyCouncilMeeting, PolicyCouncilMember, User } from "../drizzle/schema";

/**
 * REST mirror of Policy Council (§1302.50-51) for the native iOS app.
 * Paths match what ios/Sources/PolicyCouncil/PolicyCouncilView.swift expects.
 * Head Start-gated (this is a §1302 governance body), same pattern as erseaRest.ts.
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

// ---- Member <-> iOS PolicyCouncilMember shape ----

function memberToIos(row: PolicyCouncilMember) {
  return {
    id: String(row.id),
    name: row.name,
    memberType: row.memberType,
    councilRole: row.councilRole,
    familyId: row.familyId != null ? String(row.familyId) : null,
    termStart: row.termStart,
    termEnd: row.termEnd,
    status: row.status,
  };
}

// ---- Meeting <-> iOS PolicyCouncilMeeting shape ----

function meetingToIos(row: PolicyCouncilMeeting) {
  return {
    id: String(row.id),
    meetingDate: row.meetingDate,
    title: row.title,
    minutes: row.minutes ?? "",
    attendeeCount: row.attendeeCount,
    quorumMet: row.quorumMet === 1,
    actionItems: row.actionItems ?? [],
  };
}

const MEMBER_TYPES = new Set(["parent", "community_rep"]);
const COUNCIL_ROLES = new Set(["chair", "vice_chair", "secretary", "treasurer", "member"]);
const MEMBER_STATUSES = new Set(["active", "ended"]);

export function registerPolicyCouncilRoutes(app: Express) {
  // ---- Members ----
  app.get("/api/policy-council/members", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const rows = await pc.listMembers(orgId);
    res.json(rows.map(memberToIos));
  });

  app.post("/api/policy-council/members", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");

    const name = String(req.body?.name ?? "").trim();
    const memberType = String(req.body?.memberType ?? "");
    if (!name || !MEMBER_TYPES.has(memberType)) {
      return reject(res, 400, "name and memberType (parent | community_rep) are required");
    }
    const councilRole = req.body?.councilRole != null ? String(req.body.councilRole) : undefined;
    if (councilRole != null && !COUNCIL_ROLES.has(councilRole)) {
      return reject(res, 400, "Invalid councilRole");
    }
    const familyId = req.body?.familyId != null && String(req.body.familyId).trim() !== ""
      ? Number(req.body.familyId)
      : null;
    const termStart = req.body?.termStart ? new Date(req.body.termStart) : null;
    const termEnd = req.body?.termEnd ? new Date(req.body.termEnd) : null;

    let created: { id: number };
    try {
      created = await pc.addMember({
        organizationId: orgId,
        name,
        memberType: memberType as "parent" | "community_rep",
        councilRole: councilRole as PolicyCouncilMember["councilRole"] | undefined,
        familyId: familyId != null && Number.isFinite(familyId) ? familyId : null,
        termStart,
        termEnd,
      });
    } catch (e) {
      return reject(res, 404, e instanceof Error ? e.message : "Family not found in this organization");
    }

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "policy_council_member",
      resourceId: String(created.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true, id: String(created.id) });
  });

  app.post("/api/policy-council/members/:id", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const id = Number(req.params.id);
    if (!id) return reject(res, 400, "Invalid id");

    const existing = (await pc.listMembers(orgId)).find((m) => m.id === id);
    if (!existing) return reject(res, 404, "Not found");

    const councilRole = req.body?.councilRole != null ? String(req.body.councilRole) : undefined;
    if (councilRole != null && !COUNCIL_ROLES.has(councilRole)) {
      return reject(res, 400, "Invalid councilRole");
    }
    const status = req.body?.status != null ? String(req.body.status) : undefined;
    if (status != null && !MEMBER_STATUSES.has(status)) {
      return reject(res, 400, "Invalid status");
    }

    await pc.updateMember({
      id,
      organizationId: orgId,
      councilRole: councilRole as PolicyCouncilMember["councilRole"] | undefined,
      status: status as "active" | "ended" | undefined,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "policy_council_member",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  // ---- Meetings ----
  app.get("/api/policy-council/meetings", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const rows = await pc.listMeetings(orgId);
    res.json(rows.map(meetingToIos));
  });

  app.post("/api/policy-council/meetings", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");

    const title = String(req.body?.title ?? "").trim();
    const meetingDate = req.body?.meetingDate ? new Date(req.body.meetingDate) : null;
    if (!title || !meetingDate) {
      return reject(res, 400, "title and meetingDate are required");
    }
    const attendeeCount = Number.isFinite(Number(req.body?.attendeeCount)) ? Number(req.body.attendeeCount) : undefined;
    const actionItems = Array.isArray(req.body?.actionItems) ? req.body.actionItems.map(String) : undefined;

    const created = await pc.addMeeting({
      organizationId: orgId,
      meetingDate,
      title,
      minutes: req.body?.minutes != null ? String(req.body.minutes) : null,
      attendeeCount,
      quorumMet: Boolean(req.body?.quorumMet),
      actionItems,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "policy_council_meeting",
      resourceId: String(created.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true, id: String(created.id) });
  });
}

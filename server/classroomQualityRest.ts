import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { userHasModule } from "./_core/modules";
import { insertAuditLog } from "./db";
import { listAssessments, createAssessment, type AssessmentWithClassroom } from "./classroomQuality";
import type { User } from "../drizzle/schema";

/**
 * REST mirror of Classroom Quality (CLASS®/ECERS observation tracking) for
 * the native iOS app. Paths match what ios/Sources/Networking/APIClient.swift
 * expects. Head Start-gated — same pattern as erseaRest.ts — since CLASS/ECERS
 * tracking is a Head Start monitoring-review requirement.
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

// ---- Classroom assessment <-> iOS ClassroomAssessment shape ----

function assessmentToIos(row: AssessmentWithClassroom) {
  return {
    id: String(row.id),
    classroomId: String(row.classroomId),
    classroomName: row.classroomName,
    tool: row.tool,
    assessmentDate: row.assessmentDate,
    observer: row.observer ?? null,
    scores: row.scores,
    coachingNotes: row.coachingNotes ?? null,
  };
}

/** Validates + extracts the create body. Returns null (and writes the 400
 * response itself) if required fields are missing/invalid. */
function parseAssessmentBody(req: Request, res: Response) {
  const classroomId = Number(req.body?.classroomId);
  const tool = req.body?.tool;
  const assessmentDate = req.body?.assessmentDate ? new Date(req.body.assessmentDate) : null;
  if (!Number.isFinite(classroomId) || (tool !== "class" && tool !== "ecers") || !assessmentDate) {
    reject(res, 400, "classroomId, tool (class|ecers), and assessmentDate are required");
    return null;
  }
  const rawScores = req.body?.scores;
  const scores: Record<string, number> = {};
  if (rawScores != null && typeof rawScores === "object" && !Array.isArray(rawScores)) {
    for (const [key, value] of Object.entries(rawScores)) {
      const num = Number(value);
      if (Number.isFinite(num)) scores[key] = num;
    }
  }
  return {
    classroomId,
    tool: tool as "class" | "ecers",
    assessmentDate,
    observer: req.body?.observer != null && String(req.body.observer).trim() !== "" ? String(req.body.observer) : null,
    scores,
    coachingNotes: req.body?.coachingNotes != null && String(req.body.coachingNotes).trim() !== "" ? String(req.body.coachingNotes) : null,
  };
}

export function registerClassroomQualityRoutes(app: Express) {
  app.get("/api/classroom-quality", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const rows = await listAssessments(orgId);
    res.json(rows.map(assessmentToIos));
  });

  app.post("/api/classroom-quality", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const fields = parseAssessmentBody(req, res);
    if (!fields) return;
    let created: { id: number };
    try {
      created = await createAssessment({ organizationId: orgId, ...fields });
    } catch (e) {
      return reject(res, 404, e instanceof Error ? e.message : "Classroom not found in this organization");
    }
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "classroom_assessment",
      resourceId: String(created.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

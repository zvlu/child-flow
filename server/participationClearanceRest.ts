import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { computeClearanceForOrg, computeClearanceForChild } from "./participationClearance";
import type { User } from "../drizzle/schema";

/**
 * REST backing for the "cleared to attend" blocking status — consumed by
 * the web Kiosk/Attendance/roster screens and the iOS staff Attendance/
 * Children screens. See server/participationClearance.ts for what's
 * actually checked and why.
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

export function registerParticipationClearanceRoutes(app: Express) {
  // Org-wide map, keyed by childId — for roster/kiosk grids showing many
  // children's clearance badges at once without one request per child.
  app.get("/api/children/clearance", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const orgId = user.organizationId;
    if (orgId == null) {
      res.json({});
      return;
    }
    const map = await computeClearanceForOrg(orgId);
    const out: Record<string, { cleared: boolean; blockers: { code: string; label: string }[] }> = {};
    map.forEach((status, childId) => {
      out[String(childId)] = { cleared: status.cleared, blockers: status.blockers };
    });
    res.json(out);
  });

  // Single-child detail — for ChildDetail and any confirmation dialog that
  // wants the reason(s), not just the badge.
  app.get("/api/children/:id/clearance", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const orgId = user.organizationId;
    const childId = Number(req.params.id);
    if (orgId == null || !Number.isFinite(childId)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const status = await computeClearanceForChild(childId, orgId);
    res.json(status);
  });
}

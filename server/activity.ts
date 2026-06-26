import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { organizations, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, insertAuditLog, getChildById } from "./db";
import { getActivityLogs, createActivityLog, resolveStaffId, registerDeviceToken } from "./moduleDb";
import { persistMediaDataUrl } from "./storage";
import { notifyMomentPosted } from "./_core/push";

/**
 * Daily Reports / "Moments" endpoints for the native iOS staff app — the REST
 * mirror of the web's tRPC `parentPortal.activities` / `logActivity`, wrapping
 * the same moduleDb functions so web and mobile stay identical.
 *
 *   GET  /api/activity?childId=  — recent moments (newest first), optional child filter
 *   POST /api/activity           — log a moment {childId, activityType, description}
 */

const TYPES = new Set(["meal", "nap", "diaper", "activity", "note", "photo"]);

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

export function registerActivityRoutes(app: Express) {
  app.get("/api/activity", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) { res.status(401).json({ error: "Please sign in again" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const orgId = await resolveOrgId(user, db);
    if (orgId == null) { res.json([]); return; }
    const childId = req.query.childId ? Number(req.query.childId) : undefined;
    const rows = await getActivityLogs(orgId, childId && !Number.isNaN(childId) ? childId : undefined);
    res.json(rows.map(r => ({
      id: String(r.id),
      childId: String(r.childId),
      activityType: r.activityType,
      description: r.description ?? "",
      mediaUrl: r.mediaUrl ?? null,
      mediaType: r.mediaType ?? null,
      timestamp: r.timestamp.toISOString(),
      childName: r.childName,
      staffName: r.staffName,
    })));
  });

  app.post("/api/activity", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) { res.status(401).json({ error: "Please sign in again" }); return; }
    const db = await getDb();
    if (!db) { res.status(500).json({ error: "Database not available" }); return; }
    const childId = Number(req.body?.childId);
    const activityType = String(req.body?.activityType ?? "");
    const description = String(req.body?.description ?? "").trim();
    if (!childId || Number.isNaN(childId) || !TYPES.has(activityType) || !description) {
      res.status(400).json({ error: "childId, a valid activityType, and description are required" });
      return;
    }
    // Tenant check: the child must belong to the caller's org.
    const child = await getChildById(childId);
    if (!child || child.organizationId !== user.organizationId) {
      res.status(403).json({ error: "You don't have access to that child." });
      return;
    }
    const staffId = await resolveStaffId(user.organizationId, user.id);
    if (staffId == null) { res.status(400).json({ error: "No staff record to attribute this entry to" }); return; }
    let mediaUrl: string | undefined;
    let mediaType: "image" | "video" | undefined;
    if (typeof req.body?.mediaUrl === "string" && /^data:(image|video)\//.test(req.body.mediaUrl)) {
      try {
        const media = await persistMediaDataUrl(req.body.mediaUrl);
        mediaUrl = media.url; mediaType = media.mediaType;
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Couldn't save media" });
        return;
      }
    }
    const result = await createActivityLog({ childId, staffId, activityType: activityType as any, description, mediaUrl, mediaType });
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "activity_log",
      resourceId: String(childId),
      ipAddress: clientIpFromReq(req),
      detail: activityType,
    });
    // Fire-and-forget push to the child's family.
    void notifyMomentPosted(childId, description);
    res.json({ success: true, id: result.id });
  });

  // Register a device's push token (any authenticated user — staff or parent).
  app.post("/api/push/register", async (req: Request, res: Response) => {
    let user: User;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const token = String(req.body?.token ?? "").trim();
    const platform = ["ios", "android", "web"].includes(req.body?.platform) ? req.body.platform : "ios";
    if (!token) { res.status(400).json({ error: "token required" }); return; }
    await registerDeviceToken(user.id, token, platform);
    res.json({ success: true });
  });
}

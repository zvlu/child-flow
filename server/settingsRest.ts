import { eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { organizations } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./_core/password";
import { clientIpFromReq } from "./_core/audit";
import { getDb, getUserByOpenId, insertAuditLog, setUserPassword } from "./db";

/**
 * REST mirrors for the iOS "Settings" screen (Sprout staff app):
 *   GET  /api/settings          — program name + fiscal year (real org data)
 *   POST /api/settings/password — change the signed-in user's password
 *
 * Both already exist as tRPC procedures for the web app
 * (organizations/users routers); these give the iOS REST client the same
 * capability. Previously GET /api/settings had no backend route at all
 * (the iOS call always failed and silently showed blank fields), and the
 * "Update Password" button in the app had no action wired to it whatsoever.
 */

function currentFiscalYearLabel(): string {
  // Head Start / most US grant fiscal years run Oct 1 – Sep 30.
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  return `FY${year}`;
}

export function registerSettingsRoutes(app: Express) {
  app.get("/api/settings", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    let programName = "";
    let region = "";
    if (user.organizationId != null) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
      programName = org?.name ?? "";
      region = org?.address ?? "";
    }
    res.json({ programName, region, fiscalYear: currentFiscalYearLabel() });
  });

  app.post("/api/settings/password", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : undefined;
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (newPassword.length < 8 || newPassword.length > 200) {
      res.status(400).json({ error: "New password must be 8-200 characters." });
      return;
    }

    // Re-read the row so we verify against the persisted hash, not a stale one.
    const fresh = await getUserByOpenId(user.openId);
    const existingHash = fresh?.passwordHash ?? null;
    if (existingHash) {
      const ok = await verifyPassword(currentPassword ?? "", existingHash);
      if (!ok) {
        await insertAuditLog({
          userId: user.id,
          actorOpenId: user.openId,
          action: "update_failed",
          resourceType: "user",
          resourceId: String(user.id),
          ipAddress: clientIpFromReq(req),
        });
        res.status(400).json({ error: "Current password is incorrect." });
        return;
      }
    }
    await setUserPassword(user.openId, await hashPassword(newPassword));
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "user",
      resourceId: String(user.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

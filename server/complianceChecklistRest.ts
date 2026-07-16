import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { resolveStaffId } from "./moduleDb";
import { listChecklistItems, markChecklistItemReviewed } from "./complianceChecklist";
import type { User } from "../drizzle/schema";

/**
 * REST mirror of the `complianceChecklist` tRPC router (server/routers.ts)
 * for the iOS staff app's Compliance screen (MonitoringChecklistView),
 * which previously had zero persistence — see server/complianceChecklist.ts.
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

export function registerComplianceChecklistRoutes(app: Express) {
  app.get("/api/compliance/checklist", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    if (user.organizationId == null) {
      res.json([]);
      return;
    }
    res.json(await listChecklistItems(user.organizationId));
  });

  app.post("/api/compliance/checklist/:itemKey/reviewed", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    if (user.organizationId == null) {
      res.status(400).json({ error: "No organization" });
      return;
    }
    try {
      const staffId = await resolveStaffId(user.organizationId, user.id);
      const item = await markChecklistItemReviewed(
        user.organizationId,
        req.params.itemKey,
        staffId,
        typeof req.body?.note === "string" ? req.body.note : null
      );
      res.json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update checklist item" });
    }
  });
}

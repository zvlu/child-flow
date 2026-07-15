import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { userHasModule } from "./_core/modules";
import { insertAuditLog } from "./db";
import * as mod from "./moduleDb";
import type { InKindContribution, User } from "../drizzle/schema";

/**
 * REST mirror of In-Kind Contributions (tracking volunteer/donated value
 * toward the 20% non-federal match — Head Start §1302.1(b), §1301.20) for
 * the native iOS app. Mirrors the trpc `inKind` router in server/routers.ts
 * and reuses the same business logic in server/moduleDb.ts.
 * Head Start-gated, same pattern as erseaRest.ts.
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

// ---- In-kind contribution <-> iOS InKindContribution shape ----

function inKindToIos(row: InKindContribution) {
  return {
    id: String(row.id),
    type: row.type,
    contributor: row.contributor,
    description: row.description ?? "",
    date: row.date,
    hours: row.hours != null ? Number(row.hours) : null,
    value: Number(row.value),
    recordedBy: row.recordedBy != null ? String(row.recordedBy) : null,
  };
}

export function registerInKindRoutes(app: Express) {
  app.get("/api/in-kind", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const rows = await mod.getInKindContributions(orgId);
    res.json(rows.map(inKindToIos));
  });

  app.post("/api/in-kind", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");

    const type = String(req.body?.type ?? "");
    if (!["volunteer", "goods", "services", "facility", "other"].includes(type)) {
      return reject(res, 400, "type must be one of volunteer, goods, services, facility, other");
    }
    const contributor = String(req.body?.contributor ?? "").trim();
    const date = req.body?.date ? new Date(req.body.date) : null;
    const value = Number(req.body?.value);
    if (!contributor || !date || !Number.isFinite(value) || value < 0) {
      return reject(res, 400, "type, contributor, date, and value are required");
    }
    const hoursRaw = req.body?.hours;
    const hours = type === "volunteer" && hoursRaw != null && hoursRaw !== "" ? Number(hoursRaw) : null;
    if (hours != null && !Number.isFinite(hours)) {
      return reject(res, 400, "hours must be a number");
    }
    const description = req.body?.description != null ? String(req.body.description).trim() : null;

    const recordedBy = await mod.resolveStaffId(orgId, user.id);
    const result = await mod.createInKindContribution({
      organizationId: orgId,
      type: type as "volunteer" | "goods" | "services" | "facility" | "other",
      contributor,
      description: description || null,
      date,
      hours: hours != null ? String(hours) : null,
      value: String(value),
      recordedBy: recordedBy ?? user.id,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "in_kind",
      resourceId: String(result.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  app.delete("/api/in-kind/:id", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const id = Number(req.params.id);
    if (!id) return reject(res, 400, "Invalid id");

    const existing = await mod.getInKindContributions(orgId);
    if (!existing.some((r) => r.id === id)) return reject(res, 404, "Not found");

    await mod.deleteInKindContribution(id, orgId);
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "delete",
      resourceType: "in_kind",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

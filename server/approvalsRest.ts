import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { insertAuditLog } from "./db";
import { listApprovalRequests, decideApprovalRequest, type ApprovalRequestType } from "./moduleDb";
import type { User } from "../drizzle/schema";

/**
 * REST backing for the iOS staff app's Approvals inbox. Mirrors the tRPC
 * `approvals` router (server/routers.ts) that the web app uses: admins see the
 * whole org queue and can approve/deny; managers see only their own submitted
 * requests. Higher-up sign-off flow — see the approval_requests table.
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" ? user : null;
  } catch {
    return null;
  }
}

/** Human-readable title/detail for a request, from its type + parked payload. */
function describe(type: string, payloadRaw: string): { title: string; detail: string } {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(payloadRaw) as Record<string, unknown>; } catch { /* leave empty */ }
  switch (type as ApprovalRequestType) {
    case "custom_role":
      return { title: `New role: ${String(p.name ?? "—")}`, detail: `${String(p.accessLevel ?? "staff")}-access role` };
    case "staff_hire":
      return { title: `New hire: ${String(p.firstName ?? "")} ${String(p.lastName ?? "")}`.trim(), detail: `role: ${String(p.role ?? "teacher")}` };
    case "staff_role_change":
      return { title: "Role / access change", detail: p.role ? `new role: ${String(p.role)}` : "custom role change" };
    default:
      return { title: "Approval request", detail: type };
  }
}

export function registerApprovalRoutes(app: Express) {
  // List requests. Admins get the org queue; managers get their own. Optional
  // ?status=pending|approved|denied (default: pending).
  app.get("/api/approvals", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const statusParam = String(req.query.status ?? "pending");
    const status = ["pending", "approved", "denied"].includes(statusParam)
      ? (statusParam as "pending" | "approved" | "denied")
      : undefined;
    const rows = await listApprovalRequests(user.organizationId, {
      status,
      // Non-admins only ever see their own requests.
      requestedByUserId: user.role === "admin" ? undefined : user.id,
    });
    res.json(
      rows.map((r) => {
        const { title, detail } = describe(r.type, r.payload);
        return {
          id: String(r.id),
          type: r.type,
          status: r.status,
          title,
          detail,
          requestReason: r.requestReason ?? null,
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          decisionNote: r.decisionNote ?? null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    );
  });

  // Approve or deny. Admin only. Body: { approve: bool, note?: string }.
  app.post("/api/approvals/:id/review", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user || user.organizationId == null) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const approve = req.body?.approve === true;
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined;
    const result = await decideApprovalRequest({
      id,
      organizationId: user.organizationId,
      reviewerUserId: user.id,
      approve,
      note,
    });
    if (!result.ok) {
      const code = result.reason === "not_found" ? 404 : 409;
      res.status(code).json({ error: `Could not ${approve ? "approve" : "deny"} (${result.reason.replace(/_/g, " ")}).` });
      return;
    }
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "approval_request",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
      detail: approve ? `approved${result.applied ? ` -> ${result.applied.kind}:${result.applied.id}` : ""}` : "denied",
    });
    res.json({ success: true, ...result });
  });
}

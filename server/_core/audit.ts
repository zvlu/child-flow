import * as db from "../db";
import type { TrpcContext } from "./context";

type AuditAction = "read" | "create" | "update" | "delete" | "update_failed";

type AuditParams = {
  action: AuditAction;
  /** e.g. "health_record", "child", "family". */
  resourceType: string;
  resourceId?: string | number | null;
  detail?: string;
};

/** Best-effort source IP for a request, honoring a single proxy hop. */
export function clientIpFromReq(req: TrpcContext["req"]): string | undefined {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  return req.ip;
}

/**
 * Record access to a sensitive resource (child PII, health/PHI).
 *
 * Fire-and-forget: db.insertAuditLog swallows its own errors, so a logging
 * problem can never block or fail the underlying request. Call this from any
 * procedure that reads or mutates protected records.
 */
export async function auditAccess(
  ctx: TrpcContext,
  params: AuditParams
): Promise<void> {
  await db.insertAuditLog({
    userId: ctx.user?.id ?? null,
    actorOpenId: ctx.user?.openId ?? null,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId != null ? String(params.resourceId) : null,
    ipAddress: clientIpFromReq(ctx.req),
    detail: params.detail ?? null,
  });
}

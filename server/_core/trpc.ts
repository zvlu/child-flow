import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { User } from "../../drizzle/schema";
import type { TrpcContext } from "./context";
import { clientIpFromReq } from "./audit";
import { insertAuditLog } from "../db";
import { isPlatformOwner } from "./env";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Role gate. Denied attempts are written to the audit log so
 * privilege-escalation probes are visible. Best-effort logging; never blocks
 * the (already rejected) request.
 */
const requireRole = (roles: Array<User["role"]>) =>
  t.middleware(async ({ ctx, next, path }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (!roles.includes(ctx.user.role)) {
      await insertAuditLog({
        userId: ctx.user.id,
        actorOpenId: ctx.user.openId,
        action: "access_denied",
        resourceType: "rbac",
        resourceId: path,
        ipAddress: clientIpFromReq(ctx.req),
        detail: `role=${ctx.user.role} required=${roles.join("|")}`,
      });

      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

/**
 * Tenant isolation. For org-scoped routes, the requested organization (a bare
 * numeric input that IS the org id, or an `organizationId` field on an object
 * input) must match the signed-in user's organization. The platform owner is
 * exempt (manages every org). Denied attempts are audit-logged.
 *
 * Apply ONLY to routes whose numeric/`organizationId` input is an org id — not
 * to routes whose bare number is a record id (childId, familyId, …).
 */
const enforceOrgScope = t.middleware(async ({ ctx, next, getRawInput, path }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!isPlatformOwner(ctx.user.openId)) {
    let requestedOrg: number | undefined;
    try {
      const raw = await getRawInput();
      if (typeof raw === "number") requestedOrg = raw;
      else if (raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).organizationId === "number") {
        requestedOrg = (raw as Record<string, number>).organizationId;
      }
    } catch {
      /* no input */
    }
    if (requestedOrg !== undefined && ctx.user.organizationId !== requestedOrg) {
      await insertAuditLog({
        userId: ctx.user.id,
        actorOpenId: ctx.user.openId,
        action: "access_denied",
        resourceType: "org_scope",
        resourceId: path,
        ipAddress: clientIpFromReq(ctx.req),
        detail: `userOrg=${ctx.user.organizationId} requested=${requestedOrg}`,
      });
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that organization." });
    }
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Program administration: staff management, bulk operations. */
export const adminProcedure = t.procedure.use(requireRole(["admin"]));

/** Staff/admin, additionally tenant-scoped: the org in the input must be the user's. */
export const orgStaffProcedure = t.procedure.use(requireRole(["admin", "staff"])).use(enforceOrgScope);

/** Admin, additionally tenant-scoped. */
export const orgAdminProcedure = t.procedure.use(requireRole(["admin"])).use(enforceOrgScope);

/**
 * Platform owner (super-admin) gate for cross-organization management. Denied
 * attempts are audit-logged like the role gate.
 */
export const superAdminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next, path }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!isPlatformOwner(ctx.user.openId)) {
      await insertAuditLog({
        userId: ctx.user.id,
        actorOpenId: ctx.user.openId,
        action: "access_denied",
        resourceType: "rbac",
        resourceId: path,
        ipAddress: clientIpFromReq(ctx.req),
        detail: "required=platform_owner",
      });
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

/**
 * Internal program staff (admin included). This is the default tier for all
 * program-data routes — parent accounts are denied and must use the
 * family-scoped endpoints instead.
 */
export const staffProcedure = t.procedure.use(requireRole(["admin", "staff"]));

/**
 * Parent (family-app) accounts. Guarantees ctx.user.familyId is set; handlers
 * MUST scope every query to that familyId.
 */
export const parentProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next, path }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== "parent" || ctx.user.familyId == null) {
      await insertAuditLog({
        userId: ctx.user.id,
        actorOpenId: ctx.user.openId,
        action: "access_denied",
        resourceType: "rbac",
        resourceId: path,
        ipAddress: clientIpFromReq(ctx.req),
        detail: `role=${ctx.user.role} required=parent`,
      });
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user as User & { familyId: number },
      },
    });
  }),
);

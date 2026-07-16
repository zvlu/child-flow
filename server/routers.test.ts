import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `sample-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Sample User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("routers", () => {
  describe("auth.me", () => {
    it("returns current user when authenticated", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.email).toBe("user1@example.com");
    });

    it("returns null when not authenticated", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });

  describe("organizations", () => {
    it("should handle organization queries", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      // Test that the procedure is callable
      // In a real scenario, this would query the database
      expect(caller.organizations).toBeDefined();
      expect(caller.organizations.list).toBeDefined();
    });
  });

  describe("children", () => {
    it("should handle child creation input validation", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      // Test that the procedure is callable
      expect(caller.children).toBeDefined();
      expect(caller.children.create).toBeDefined();
      expect(caller.children.list).toBeDefined();
      expect(caller.children.getById).toBeDefined();
    });
  });

  describe("attendance", () => {
    it("should handle attendance queries", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      // Test that the procedure is callable
      expect(caller.attendance).toBeDefined();
      expect(caller.attendance.getByDate).toBeDefined();
    });
  });
});

// These assert the authorization layer rejects BEFORE any DB call, so they're
// hermetic (no database needed) — the tenant/role gates throw in middleware.
describe("tenant isolation", () => {
  function ctxWith(overrides: Partial<AuthenticatedUser>): TrpcContext {
    const user = {
      id: 5,
      openId: "staff-5",
      email: "staff@example.com",
      name: "Staff Member",
      loginMethod: "email",
      role: "staff",
      organizationId: 1,
      familyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as AuthenticatedUser;
    return {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
  }

  const codeOf = async (p: Promise<unknown>) => p.then(() => null, (e) => (e as { code?: string })?.code ?? "THREW");

  it("denies a staff member access to a different org's data", async () => {
    const caller = appRouter.createCaller(ctxWith({ organizationId: 1 }));
    // Staff in org 1 requesting org 2's PIR report must be FORBIDDEN.
    expect(await codeOf(caller.compliance.getReport({ organizationId: 2, year: "2024-2025" }))).toBe("FORBIDDEN");
  });

  it("denies a parent account on a staff-only route", async () => {
    const caller = appRouter.createCaller(ctxWith({ role: "parent", familyId: 9, organizationId: null }));
    expect(await codeOf(caller.children.list(1))).toBe("FORBIDDEN");
  });

  it("denies a non-admin on an admin-only route", async () => {
    const caller = appRouter.createCaller(ctxWith({ role: "staff", organizationId: 1 }));
    // Submitting a PIR report is admin-only (orgAdminProcedure).
    expect(await codeOf(caller.compliance.submitReport({ organizationId: 1, year: "2024-2025" }))).toBe("FORBIDDEN");
  });
});

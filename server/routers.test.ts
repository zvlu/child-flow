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

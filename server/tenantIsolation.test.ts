import { describe, expect, it, vi } from "vitest";

// Force the org-scope check ON regardless of local env: if ALLOW_DEV_AUTH_BYPASS
// were set (and no OWNER_OPEN_ID), every user would count as the platform owner
// and skip enforcement. Pinning isPlatformOwner=false keeps these deterministic.
vi.mock("./_core/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ...actual, isPlatformOwner: () => false };
});

import { appRouter } from "./routers";

/** A non-owner staff user scoped to `organizationId`. */
function staffCtx(organizationId: number) {
  return {
    user: {
      id: 7,
      openId: "staff-nonowner",
      email: "staff@example.org",
      name: "Staff Member",
      loginMethod: "password",
      role: "staff",
      organizationId,
      familyId: null,
      avatarUrl: null,
      passwordHash: null,
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
    res: { clearCookie: () => {}, cookie: () => {} },
  } as any;
}

const ORG_ERR = /access to that organization/i;

describe("tenant isolation — org-scope enforcement", () => {
  it("denies a bare org-id route for a different org", async () => {
    const caller = appRouter.createCaller(staffCtx(1));
    await expect(caller.children.list(2)).rejects.toThrow(ORG_ERR);
  });

  it("denies an object-input route (organizationId field) for a different org", async () => {
    const caller = appRouter.createCaller(staffCtx(1));
    await expect(caller.education.list({ organizationId: 2 })).rejects.toThrow(ORG_ERR);
  });

  it("denies families.list for a different org", async () => {
    const caller = appRouter.createCaller(staffCtx(1));
    await expect(caller.families.list(2)).rejects.toThrow(ORG_ERR);
  });

  it("allows a route for the user's own org", async () => {
    // No DATABASE_URL under test, so the query layer returns [] — the point is
    // that the org-scope check does NOT reject the matching org.
    const caller = appRouter.createCaller(staffCtx(2));
    await expect(caller.children.list(2)).resolves.toBeDefined();
  });
});

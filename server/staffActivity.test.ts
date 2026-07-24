import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

vi.mock("./_core/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ...actual, isPlatformOwner: () => false };
});

// Control the reporting-line permission decision + the activity fetch so we can
// assert the router's guard wiring without a DB.
vi.mock("./moduleDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./moduleDb")>();
  return {
    ...actual,
    canViewStaffActivity: vi.fn(),
    getStaffUserId: vi.fn(async () => 100),
    getActivityForUser: vi.fn(async () => [{ id: 1, action: "view", resourceType: "page" }]),
  };
});

import { appRouter } from "./routers";
import * as mod from "./moduleDb";

const asMock = (fn: unknown) => fn as unknown as Mock;

function ctx(role: "admin" | "staff", organizationId = 1) {
  return {
    user: {
      id: 7, openId: `user-${role}`, email: `${role}@x.org`, name: role, loginMethod: "password",
      role, organizationId, familyId: null, avatarUrl: null, passwordHash: null, settings: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
    res: { clearCookie: () => {}, cookie: () => {} },
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe("activity.forStaff — reporting-line visibility", () => {
  it("returns the timeline when the viewer is in the employee's reporting line", async () => {
    asMock(mod.canViewStaffActivity).mockResolvedValue(true);
    const res = await appRouter.createCaller(ctx("staff")).activity.forStaff({ organizationId: 1, staffId: 9 });
    expect(mod.canViewStaffActivity).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 1, targetStaffId: 9, userId: 7 }));
    expect(mod.getActivityForUser).toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });

  it("forbids a viewer who is not above the employee (peer / report)", async () => {
    asMock(mod.canViewStaffActivity).mockResolvedValue(false);
    await expect(
      appRouter.createCaller(ctx("staff")).activity.forStaff({ organizationId: 1, staffId: 9 }),
    ).rejects.toThrow(/supervisors/i);
    expect(mod.getActivityForUser).not.toHaveBeenCalled();
  });

  it("blocks cross-org access before any visibility check", async () => {
    asMock(mod.canViewStaffActivity).mockResolvedValue(true);
    await expect(
      appRouter.createCaller(ctx("staff", 1)).activity.forStaff({ organizationId: 2, staffId: 9 }),
    ).rejects.toThrow(/access to that organization/i);
    expect(mod.canViewStaffActivity).not.toHaveBeenCalled();
  });
});

describe("canViewStaffActivity — admin short-circuit", () => {
  it("an admin can view anyone without a staff lookup", async () => {
    // The real implementation (kept via importOriginal spread is overridden above,
    // so call through the router with the mock instead is covered elsewhere);
    // here we assert the admin branch returns true without throwing on no DB.
    const actual = await vi.importActual<typeof import("./moduleDb")>("./moduleDb");
    await expect(
      actual.canViewStaffActivity({ organizationId: 1, userId: 7, accessTier: "admin", targetStaffId: 9 }),
    ).resolves.toBe(true);
  });
});

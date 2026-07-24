import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

// Keep the org-scope check deterministic (no owner bypass), like tenantIsolation.test.
vi.mock("./_core/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ...actual, isPlatformOwner: () => false };
});

// Mock the data layer so we can assert WHICH action the router takes (apply now
// vs. park as an approval) without a live DB. resolveStaffManagement is the
// admin/manager gate; the create*/update* fns are the apply handlers.
vi.mock("./moduleDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./moduleDb")>();
  return {
    ...actual,
    resolveStaffManagement: vi.fn(),
    createApprovalRequest: vi.fn(async () => ({ id: 123 })),
    createStaff: vi.fn(async () => ({ id: 55 })),
    createCustomRole: vi.fn(async () => ({ id: 66 })),
    updateStaff: vi.fn(async () => ({ success: true })),
    getRecordOrgId: vi.fn(async () => 1),
    getStaffInOrg: vi.fn(async () => ({ id: 9, organizationId: 1 })),
    wouldCreateSupervisorCycle: vi.fn(async () => false),
    reparentReportsOnDeactivate: vi.fn(async () => 0),
    decideApprovalRequest: vi.fn(async () => ({ ok: true, applied: { kind: "custom_role", id: 66 } })),
  };
});

import { appRouter } from "./routers";
import * as mod from "./moduleDb";

const asMock = (fn: unknown) => fn as unknown as Mock;

function ctx(role: "admin" | "staff", organizationId = 1) {
  return {
    user: {
      id: 7, openId: `user-${role}`, email: `${role}@example.org`, name: role,
      loginMethod: "password", role, organizationId, familyId: null,
      avatarUrl: null, passwordHash: null, settings: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
    res: { clearCookie: () => {}, cookie: () => {} },
  } as any;
}

/** resolveStaffManagement return for a manager (non-admin, allowed). */
const MANAGER = { allowed: true, isAdmin: false, actorStaffId: 42 };
/** resolveStaffManagement return for an admin. */
const ADMIN = { allowed: true, isAdmin: true, actorStaffId: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  asMock(mod.createApprovalRequest).mockResolvedValue({ id: 123 });
  asMock(mod.createStaff).mockResolvedValue({ id: 55 });
  asMock(mod.createCustomRole).mockResolvedValue({ id: 66 });
  asMock(mod.updateStaff).mockResolvedValue({ success: true });
  asMock(mod.getRecordOrgId).mockResolvedValue(1);
  asMock(mod.decideApprovalRequest).mockResolvedValue({ ok: true, applied: { kind: "custom_role", id: 66 } });
});

describe("custom role creation — director escalation", () => {
  it("director creating a STAFF-access role applies immediately", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(MANAGER);
    const res = await appRouter.createCaller(ctx("staff")).roles.create({
      organizationId: 1, name: "Bus Aide", accessLevel: "staff", color: "sage",
    });
    expect(mod.createCustomRole).toHaveBeenCalledOnce();
    expect(mod.createApprovalRequest).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(false);
  });

  it("director creating an ADMIN-access role is parked for approval", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(MANAGER);
    const res = await appRouter.createCaller(ctx("staff")).roles.create({
      organizationId: 1, name: "Deputy Admin", accessLevel: "admin", color: "red",
    });
    expect(mod.createApprovalRequest).toHaveBeenCalledOnce();
    expect(asMock(mod.createApprovalRequest).mock.calls[0][0]).toMatchObject({ type: "custom_role", organizationId: 1 });
    expect(mod.createCustomRole).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(true);
  });

  it("admin creating an ADMIN-access role applies immediately (no approval)", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(ADMIN);
    const res = await appRouter.createCaller(ctx("admin")).roles.create({
      organizationId: 1, name: "Co-Director", accessLevel: "admin", color: "amber",
    });
    expect(mod.createCustomRole).toHaveBeenCalledOnce();
    expect(mod.createApprovalRequest).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(false);
  });

  it("a non-manager staffer is forbidden from creating roles", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue({ allowed: false, isAdmin: false, actorStaffId: null });
    await expect(
      appRouter.createCaller(ctx("staff")).roles.create({ organizationId: 1, name: "X", accessLevel: "staff", color: "sage" }),
    ).rejects.toThrow(/permission to create roles/i);
    expect(mod.createCustomRole).not.toHaveBeenCalled();
  });
});

describe("staff hire — director escalation", () => {
  it("director's hire is parked for approval, not created", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(MANAGER);
    const res = await appRouter.createCaller(ctx("staff")).staff.create({
      organizationId: 1, firstName: "New", lastName: "Hire", role: "teacher",
    });
    expect(mod.createApprovalRequest).toHaveBeenCalledOnce();
    expect(asMock(mod.createApprovalRequest).mock.calls[0][0]).toMatchObject({ type: "staff_hire" });
    expect(mod.createStaff).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(true);
  });

  it("admin's hire is created directly", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(ADMIN);
    const res = await appRouter.createCaller(ctx("admin")).staff.create({
      organizationId: 1, firstName: "New", lastName: "Hire", role: "teacher",
    });
    expect(mod.createStaff).toHaveBeenCalledOnce();
    expect(mod.createApprovalRequest).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(false);
  });

  it("accepts the newly added roles (e.g. assistant_director)", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(ADMIN);
    await expect(
      appRouter.createCaller(ctx("admin")).staff.create({
        organizationId: 1, firstName: "Dana", lastName: "Lee", role: "assistant_director",
      }),
    ).resolves.toMatchObject({ pendingApproval: false });
  });
});

describe("staff role/access change — director escalation", () => {
  it("a manager changing a report's role is parked for approval", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(MANAGER);
    const res = await appRouter.createCaller(ctx("staff")).staff.update({
      id: 9, organizationId: 1, role: "lead_teacher",
    });
    expect(mod.createApprovalRequest).toHaveBeenCalledOnce();
    expect(asMock(mod.createApprovalRequest).mock.calls[0][0]).toMatchObject({ type: "staff_role_change", targetStaffId: 9 });
    expect(mod.updateStaff).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(true);
  });

  it("a manager editing a non-role field applies directly", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(MANAGER);
    const res = await appRouter.createCaller(ctx("staff")).staff.update({
      id: 9, organizationId: 1, phone: "555-0100",
    });
    expect(mod.updateStaff).toHaveBeenCalledOnce();
    expect(mod.createApprovalRequest).not.toHaveBeenCalled();
    expect(res.pendingApproval).toBe(false);
  });

  it("an admin role change applies directly", async () => {
    asMock(mod.resolveStaffManagement).mockResolvedValue(ADMIN);
    await appRouter.createCaller(ctx("admin")).staff.update({ id: 9, organizationId: 1, role: "director" });
    expect(mod.updateStaff).toHaveBeenCalledOnce();
    expect(mod.createApprovalRequest).not.toHaveBeenCalled();
  });
});

describe("approvals inbox — admin only", () => {
  it("approve is denied to non-admin access tier", async () => {
    await expect(
      appRouter.createCaller(ctx("staff")).approvals.approve({ id: 1, organizationId: 1 }),
    ).rejects.toThrow();
    expect(mod.decideApprovalRequest).not.toHaveBeenCalled();
  });

  it("admin approve dispatches to decideApprovalRequest", async () => {
    const res = await appRouter.createCaller(ctx("admin")).approvals.approve({ id: 5, organizationId: 1 });
    expect(mod.decideApprovalRequest).toHaveBeenCalledOnce();
    expect(asMock(mod.decideApprovalRequest).mock.calls[0][0]).toMatchObject({ id: 5, organizationId: 1, approve: true });
    expect(res.ok).toBe(true);
  });

  it("approving across orgs is blocked by tenant scope", async () => {
    await expect(
      appRouter.createCaller(ctx("admin", 1)).approvals.approve({ id: 5, organizationId: 2 }),
    ).rejects.toThrow(/access to that organization/i);
    expect(mod.decideApprovalRequest).not.toHaveBeenCalled();
  });

  it("a stale/non-pending request surfaces a friendly error", async () => {
    asMock(mod.decideApprovalRequest).mockResolvedValue({ ok: false, reason: "already_reviewed" });
    await expect(
      appRouter.createCaller(ctx("admin")).approvals.approve({ id: 5, organizationId: 1 }),
    ).rejects.toThrow(/already reviewed/i);
  });
});

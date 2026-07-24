import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { ROLE_LABELS } from "@shared/roles";
import { classrooms, staff, staffTrainingLogs, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, getOrganizationUsage, insertAuditLog } from "./db";
import {
  createStaff, updateStaff, getCustomRoles, resolveStaffManagement, createApprovalRequest,
  canViewStaffActivity, getStaffUserId, getActivityForUser,
} from "./moduleDb";

/** One-line, human-readable label for an audit-log activity row (mirrors the
 *  web StaffDetail's activityLabel so both surfaces read the same). */
function activityText(a: { action: string; resourceType: string; resourceId?: string | null; detail?: string | null }): string {
  const what = a.detail || a.resourceId || a.resourceType;
  switch (a.action) {
    case "view": return `Viewed ${what}`;
    case "login": return "Signed in";
    case "logout": return "Signed out";
    case "create": return `Created ${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ""}`;
    case "update": return `Updated ${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ""}`;
    case "delete": return `Deleted ${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ""}`;
    case "access_denied": return `Blocked from ${what}`;
    default: return `${a.action} ${a.resourceType}`;
  }
}

/**
 * REST backing for the iOS staff app's "Staff Directory" screen
 * (ios/Sources/Staff/StaffView.swift), which has always called GET /api/staff
 * — a route that never existed server-side, so the directory was silently
 * empty outside DEBUG's mock-data fallback.
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

// ROLE_LABELS is imported from @shared/roles (single source of truth).

export function registerStaffDirectoryRoutes(app: Express) {
  app.get("/api/staff", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const org = user.organizationId != null ? { id: user.organizationId } : null;
    if (!org) {
      res.json([]);
      return;
    }

    const rows = await db.select().from(staff).where(eq(staff.organizationId, org.id));
    const rooms = await db
      .select({ id: classrooms.id, name: classrooms.name, teacherId: classrooms.teacherId, assistantId: classrooms.assistantId })
      .from(classrooms)
      .where(eq(classrooms.organizationId, org.id));
    const classroomByStaffId = new Map<number, string>();
    for (const r of rooms) {
      if (r.teacherId != null) classroomByStaffId.set(r.teacherId, r.name);
      if (r.assistantId != null && !classroomByStaffId.has(r.assistantId)) classroomByStaffId.set(r.assistantId, r.name);
    }

    const trainingRows = await db
      .select({ staffId: staffTrainingLogs.staffId, hours: staffTrainingLogs.hours })
      .from(staffTrainingLogs)
      .where(eq(staffTrainingLogs.organizationId, org.id));
    const trainingHoursByStaff = new Map<number, number>();
    for (const t of trainingRows) {
      trainingHoursByStaff.set(t.staffId, (trainingHoursByStaff.get(t.staffId) ?? 0) + Number(t.hours));
    }

    // Org-defined custom role labels: when a staffer has one, its name is the
    // display title (the fixed `role` still drives the enum color/semantics).
    const customRoleById = new Map<number, string>();
    for (const cr of await getCustomRoles(org.id)) customRoleById.set(cr.id, cr.name);

    res.json(
      rows
        .filter((s) => s.isActive !== 0)
        .map((s) => ({
          id: String(s.id),
          fullName: `${s.firstName} ${s.lastName}`,
          role: (s.customRoleId != null ? customRoleById.get(s.customRoleId) : undefined)
            ?? ROLE_LABELS[s.role ?? "teacher"] ?? "Staff",
          roleKey: s.role ?? "teacher",
          customRoleId: s.customRoleId ?? null,
          email: s.email ?? "",
          phone: s.phone ?? "",
          trainingHours: trainingHoursByStaff.get(s.id) ?? 0,
          classroom: classroomByStaffId.get(s.id) ?? null,
        }))
    );
  });

  /**
   * Create/update a staff member — previously StaffView.swift's "Add Staff
   * Member" and edit flows only mutated a local array; there was no REST
   * endpoint reachable from iOS (staff.create/staff.update existed as tRPC
   * only, admin-gated to match the web page's permission model).
   */
  app.post("/api/staff", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    // Admins add directly; manager-tier staff (director, coordinators) may add
    // people, but the hire is parked as a pending approval for a higher-up.
    const mgmt = await resolveStaffManagement({ organizationId: user.organizationId, userId: user.id, accessTier: user.role });
    if (!mgmt.allowed) {
      res.status(403).json({ error: "You don't have permission to add staff." });
      return;
    }
    const usage = await getOrganizationUsage(user.organizationId);
    if (usage?.maxStaff != null && usage.staff + 1 > usage.maxStaff) {
      res.status(403).json({
        error: `Staff limit reached — your ${usage.subscriptionTier} plan allows ${usage.maxStaff} staff (currently ${usage.staff}).`,
      });
      return;
    }
    const firstName = String(req.body?.firstName ?? "").trim();
    const lastName = String(req.body?.lastName ?? "").trim();
    if (!firstName || !lastName) {
      res.status(400).json({ error: "firstName and lastName are required" });
      return;
    }
    const supervisorId = mgmt.isAdmin
      ? (req.body?.supervisorId != null ? Number(req.body.supervisorId) : undefined)
      : (mgmt.actorStaffId ?? undefined);
    const payload = {
      organizationId: user.organizationId,
      firstName,
      lastName,
      email: req.body?.email ?? null,
      phone: req.body?.phone ?? null,
      position: req.body?.position ?? null,
      role: req.body?.role ?? "teacher",
      customRoleId: req.body?.customRoleId != null ? Number(req.body.customRoleId) : null,
      supervisorId,
    };
    if (!mgmt.isAdmin) {
      const reqRow = await createApprovalRequest({
        organizationId: user.organizationId,
        type: "staff_hire",
        payload: JSON.stringify(payload),
        requestedByUserId: user.id,
        requestedByStaffId: mgmt.actorStaffId ?? null,
      });
      await insertAuditLog({
        userId: user.id,
        actorOpenId: user.openId,
        action: "create",
        resourceType: "approval_request",
        resourceId: String(reqRow.id),
        ipAddress: clientIpFromReq(req),
        detail: "staff_hire",
      });
      res.json({ pendingApproval: true, approvalId: Number(reqRow.id) });
      return;
    }
    const result = await createStaff(payload);
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "staff",
      resourceId: String(result.id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ pendingApproval: false, id: String(result.id) });
  });

  app.post("/api/staff/:id", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user || user.organizationId == null) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const id = Number(req.params.id);
    const db = await getDb();
    if (!db || !Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const [existing] = await db.select({ organizationId: staff.organizationId }).from(staff).where(eq(staff.id, id));
    if (!existing || existing.organizationId !== user.organizationId) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const key of ["firstName", "lastName", "email", "phone", "position", "role", "isActive"] as const) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    await updateStaff(id, patch);
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "staff",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  /**
   * One employee's app-activity timeline (iOS staff detail). Visible only along
   * the reporting line — an admin, or someone above the employee in the
   * supervisor tree. A staffer with no reports sees no one's activity. Mirrors
   * the web tRPC activity.forStaff guard exactly (canViewStaffActivity).
   */
  app.get("/api/staff/:id/activity", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const staffId = Number(req.params.id);
    if (!Number.isFinite(staffId)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const allowed = await canViewStaffActivity({
      organizationId: user.organizationId,
      userId: user.id,
      accessTier: user.role,
      targetStaffId: staffId,
    });
    if (!allowed) {
      res.status(403).json({ error: "Activity is visible only to this employee's supervisors." });
      return;
    }
    const targetUserId = await getStaffUserId(user.organizationId, staffId);
    if (targetUserId == null) {
      res.json([]);
      return;
    }
    const rows = await getActivityForUser(targetUserId, 100);
    res.json(rows.map((r) => ({
      id: String(r.id),
      label: activityText(r),
      at: r.createdAt ? r.createdAt.toISOString() : null,
    })));
  });

  /**
   * Log training hours — previously "Log Training Hours" in StaffView.swift
   * mutated local state only; no concept of tracked training existed
   * anywhere (trainingHours above was a hardcoded 0). See
   * drizzle/schema.ts's staffTrainingLogs table.
   */
  app.post("/api/staff/training", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    const staffId = Number(req.body?.staffId);
    const hours = Number(req.body?.hours);
    const trainingName = String(req.body?.trainingName ?? "").trim();
    if (!db || !staffId || !hours || !trainingName) {
      res.status(400).json({ error: "staffId, hours, and trainingName are required" });
      return;
    }
    const [result] = await db.insert(staffTrainingLogs).values({
      staffId,
      organizationId: user.organizationId,
      trainingName,
      hours: String(hours),
      trainingDate: req.body?.trainingDate ? new Date(req.body.trainingDate) : new Date(),
      notes: req.body?.notes ?? null,
      recordedBy: user.id,
    });
    res.json({ id: result.insertId, success: true });
  });

  /**
   * Reassign a classroom's teacher/assistant — previously StaffView.swift's
   * "Assign Classroom" only updated local state; `classrooms.teacherId`/
   * `assistantId` already existed, but no endpoint could write to them from
   * a staff-reassignment angle (only child-to-classroom assignment existed,
   * server/moduleDb.ts's assignChildToClassroom).
   */
  app.post("/api/classrooms/:id/assign-staff", async (req: Request, res: Response) => {
    const user = await requireAdmin(req);
    if (!user || user.organizationId == null) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const id = Number(req.params.id);
    const role = req.body?.role === "assistant" ? "assistant" : req.body?.role === "teacher" ? "teacher" : null;
    const db = await getDb();
    if (!db || !Number.isFinite(id) || !role) {
      res.status(400).json({ error: "Invalid request — role must be 'teacher' or 'assistant'" });
      return;
    }
    const [existing] = await db
      .select({ organizationId: classrooms.organizationId })
      .from(classrooms)
      .where(eq(classrooms.id, id));
    if (!existing || existing.organizationId !== user.organizationId) {
      res.status(404).json({ error: "Classroom not found" });
      return;
    }
    const staffIdRaw = req.body?.staffId;
    const staffId = staffIdRaw == null ? null : Number(staffIdRaw);
    const column = role === "teacher" ? { teacherId: staffId } : { assistantId: staffId };
    await db.update(classrooms).set(column).where(eq(classrooms.id, id));
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "classroom",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
      detail: `${role} -> staff:${staffId ?? "none"}`,
    });
    res.json({ success: true });
  });
}

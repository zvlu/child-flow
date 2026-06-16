import { MOBILE_SESSION_TTL_MS } from "@shared/const";
import { randomBytes } from "crypto";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  attendance,
  calendarEvents,
  childClassroomAssignments,
  children,
  classrooms,
  families,
  familyGoals,
  familyInvitations,
  organizations,
  parentNotifications,
  staff,
  users,
  type InsertFamilyInvitation,
  type User,
} from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { getDb, getHealthFollowUpAlerts, insertAuditLog } from "./db";

/**
 * Family (parent) account flows for the ChildFlowFamily iOS app.
 *
 * Setup model per role:
 * - admin/staff: internal accounts, sign in via /api/auth/login (or OAuth on
 *   web); staff accounts are managed by admins.
 * - parent: staff generate a one-time invitation code bound to a family
 *   (families.createInvitation). The parent verifies the code, proves identity
 *   with their child's date of birth, and registers an account that is
 *   permanently scoped to that family. Every endpoint here re-checks that
 *   scoping — parents can never read another family's data.
 */

// Unambiguous charset (no 0/O, 1/I/L) for codes parents type by hand.
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function generateInvitationCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[bytes[i]! % CODE_CHARSET.length];
  }
  return `CF-${code}`;
}

// ==================== Invitation queries (also used by routers.ts) ====================

export async function createFamilyInvitation(params: {
  organizationId: number;
  familyId: number;
  adultEmail?: string | null;
  createdBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Retry a few times in the (unlikely) event of a code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInvitationCode();
    try {
      const values: InsertFamilyInvitation = {
        organizationId: params.organizationId,
        familyId: params.familyId,
        code,
        adultEmail: params.adultEmail ?? null,
        createdBy: params.createdBy ?? null,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      };
      await db.insert(familyInvitations).values(values);
      const [row] = await db
        .select()
        .from(familyInvitations)
        .where(eq(familyInvitations.code, code))
        .limit(1);
      return row!;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error("Failed to generate invitation code");
}

export async function listFamilyInvitations(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: familyInvitations.id,
      familyId: familyInvitations.familyId,
      familyName: families.primaryContactName,
      code: familyInvitations.code,
      adultEmail: familyInvitations.adultEmail,
      expiresAt: familyInvitations.expiresAt,
      usedAt: familyInvitations.usedAt,
      createdAt: familyInvitations.createdAt,
    })
    .from(familyInvitations)
    .innerJoin(families, eq(familyInvitations.familyId, families.id))
    .where(eq(familyInvitations.organizationId, organizationId))
    .orderBy(desc(familyInvitations.createdAt));
}

async function getActiveInvitationByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(familyInvitations)
    .where(
      and(
        eq(familyInvitations.code, code),
        isNull(familyInvitations.usedAt),
        gte(familyInvitations.expiresAt, new Date())
      )
    )
    .limit(1);
  return row;
}

// ==================== Profile assembly ====================

function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateOnlyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Builds the FamilyProfile shape the iOS family app decodes. */
async function buildFamilyProfile(user: User & { familyId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, user.familyId))
    .limit(1);
  if (!family) throw new Error("Family not found");

  const kids = await db
    .select()
    .from(children)
    .where(eq(children.familyId, family.id));

  // Classroom + teacher per child, via the child's active classroom assignment.
  const kidIds = kids.map(k => k.id);
  const classroomByChild = new Map<number, { classroom: string; teacher: string }>();
  if (kidIds.length > 0) {
    const assignments = await db
      .select({
        childId: childClassroomAssignments.childId,
        classroomName: classrooms.name,
        teacherFirst: staff.firstName,
        teacherLast: staff.lastName,
      })
      .from(childClassroomAssignments)
      .innerJoin(classrooms, eq(childClassroomAssignments.classroomId, classrooms.id))
      .leftJoin(staff, eq(classrooms.teacherId, staff.id))
      .where(
        and(
          inArray(childClassroomAssignments.childId, kidIds),
          eq(childClassroomAssignments.isActive, 1)
        )
      );
    for (const a of assignments) {
      if (!classroomByChild.has(a.childId)) {
        classroomByChild.set(a.childId, {
          classroom: a.classroomName ?? "",
          teacher: [a.teacherFirst, a.teacherLast].filter(Boolean).join(" "),
        });
      }
    }
  }

  // Attendance rate over the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const attendanceRows = await db
    .select({ childId: attendance.childId, status: attendance.status })
    .from(attendance)
    .where(and(eq(attendance.organizationId, family.organizationId), gte(attendance.date, since)));
  const rateFor = (childId: number): number => {
    const rows = attendanceRows.filter(r => r.childId === childId);
    if (rows.length === 0) return 100;
    const present = rows.filter(r => r.status === "present" || r.status === "half_day").length;
    return Math.round((present / rows.length) * 100);
  };

  // Health: overdue / due-soon follow-ups per child.
  const healthAlerts = await getHealthFollowUpAlerts(family.organizationId, 30);
  const healthFor = (childId: number): string => {
    const alerts = healthAlerts.filter(a => a.childId === childId);
    if (alerts.some(a => a.severity === "overdue")) return "Action needed";
    if (alerts.length > 0) return "Due soon";
    return "Up to date";
  };

  // Next family-relevant event (exclude internal staff events).
  const upcoming = await db
    .select({ title: calendarEvents.title, eventType: calendarEvents.eventType })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.organizationId, family.organizationId),
        gte(calendarEvents.startDate, new Date())
      )
    )
    .orderBy(calendarEvents.startDate)
    .limit(10);
  const nextEvent = upcoming.find(
    e => e.eventType !== "staff_training" && e.eventType !== "deadline"
  );

  return {
    id: String(family.id),
    fullName: user.name ?? family.primaryContactName,
    email: user.email ?? family.primaryContactEmail ?? "",
    children: kids.map(c => ({
      id: String(c.id),
      firstName: c.firstName,
      lastName: c.lastName,
      classroom: classroomByChild.get(c.id)?.classroom ?? "",
      teacher: classroomByChild.get(c.id)?.teacher ?? "",
      dateOfBirth: c.dateOfBirth ? dateOnly(c.dateOfBirth) : "",
      enrollmentStatus: c.status ?? "active",
      attendanceRate: rateFor(c.id),
      healthStatus: healthFor(c.id),
      nextEvent: nextEvent?.title ?? null,
    })),
  };
}

// ==================== Auth helpers ====================

async function requireParent(req: Request): Promise<(User & { familyId: number }) | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "parent" || user.familyId == null) return null;
    return user as User & { familyId: number };
  } catch {
    return null;
  }
}

const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

// ==================== Routes ====================

export function registerFamilyRoutes(app: Express) {
  /** Step 1 of onboarding: validate an invitation code. */
  app.post("/api/family/auth/verify-code", async (req: Request, res: Response) => {
    const code =
      typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const invitation = await getActiveInvitationByCode(code);
    if (!invitation) {
      res.status(404).json({ error: "Invalid or expired invitation code" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, invitation.familyId))
      .limit(1);
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invitation.organizationId))
      .limit(1);
    const kids = await db
      .select()
      .from(children)
      .where(eq(children.familyId, invitation.familyId));

    res.json({
      code: invitation.code,
      childName: kids[0] ? `${kids[0].firstName} ${kids[0].lastName}` : "",
      programName: org?.name ?? "",
      adultEmail: invitation.adultEmail ?? family?.primaryContactEmail ?? "",
    });
  });

  /**
   * Step 2: create the parent account. Identity is proven by the invitation
   * code plus the child's date of birth (when one is on file).
   */
  app.post("/api/family/auth/register", async (req: Request, res: Response) => {
    const code =
      typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const dobRaw = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth : "";
    const ip = clientIpFromReq(req);

    if (!code || !email || !password || !dobRaw) {
      res.status(400).json({ error: "Code, email, date of birth, and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const invitation = await getActiveInvitationByCode(code);
    if (!invitation) {
      res.status(404).json({ error: "Invalid or expired invitation code" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    // Identity check: the provided DOB must match a child in the invited
    // family (skipped only when no child has a DOB on file). Compare in both
    // local and UTC date renderings to absorb timezone offsets.
    const kids = await db
      .select()
      .from(children)
      .where(eq(children.familyId, invitation.familyId));
    const kidsWithDob = kids.filter(k => k.dateOfBirth != null);
    if (kidsWithDob.length > 0) {
      const provided = new Date(dobRaw);
      const providedDates = new Set([dateOnly(provided), dateOnlyUTC(provided)]);
      const matches = kidsWithDob.some(k => {
        const stored = k.dateOfBirth!;
        return providedDates.has(dateOnly(stored)) || providedDates.has(dateOnlyUTC(stored));
      });
      if (!matches) {
        await insertAuditLog({
          action: "login_failed",
          resourceType: "family_registration",
          resourceId: code,
          ipAddress: ip,
          detail: "DOB mismatch",
        });
        res.status(403).json({ error: "Date of birth does not match our records" });
        return;
      }
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, invitation.familyId))
      .limit(1);

    const openId = `parent-${randomBytes(12).toString("hex")}`;
    const name = family?.primaryContactName || email.split("@")[0]!;
    await db.insert(users).values({
      openId,
      name,
      email,
      loginMethod: "email",
      passwordHash: await hashPassword(password),
      role: "parent",
      familyId: invitation.familyId,
    });
    await db
      .update(familyInvitations)
      .set({ usedAt: new Date() })
      .where(eq(familyInvitations.id, invitation.id));

    const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    await insertAuditLog({
      userId: user!.id,
      actorOpenId: openId,
      action: "create",
      resourceType: "parent_account",
      resourceId: String(invitation.familyId),
      ipAddress: ip,
      detail: `invitation:${code}`,
    });

    const token = await sdk.createSessionToken(openId, {
      name,
      expiresInMs: MOBILE_SESSION_TTL_MS,
    });
    const profile = await buildFamilyProfile(user as User & { familyId: number });
    res.json({ token, profile });
  });

  /** Returning parent sign-in. */
  app.post("/api/family/auth/login", async (req: Request, res: Response) => {
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const ip = clientIpFromReq(req);

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    const isParent = user?.role === "parent" && user.familyId != null;

    if (!user || !passwordOk || !isParent) {
      await insertAuditLog({
        userId: user?.id ?? null,
        actorOpenId: user?.openId ?? null,
        action: "login_failed",
        resourceType: "auth",
        resourceId: email,
        ipAddress: ip,
        detail: "family app",
      });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = await sdk.createSessionToken(user.openId, {
      name: user.name ?? "",
      expiresInMs: MOBILE_SESSION_TTL_MS,
    });
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "login",
      resourceType: "auth",
      ipAddress: ip,
      detail: "family app",
    });

    const profile = await buildFamilyProfile(user as User & { familyId: number });
    res.json({ token, profile });
  });

  /** Authenticated: the parent's own family profile (children, status). */
  app.get("/api/family/profile", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    await insertAuditLog({
      userId: parent.id,
      actorOpenId: parent.openId,
      action: "read",
      resourceType: "family",
      resourceId: String(parent.familyId),
      ipAddress: clientIpFromReq(req),
    });
    res.json(await buildFamilyProfile(parent));
  });

  /** Authenticated: upcoming family-relevant program events. */
  app.get("/api/family/events", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, parent.familyId))
      .limit(1);
    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }
    const rows = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.organizationId, family.organizationId),
          gte(calendarEvents.startDate, new Date())
        )
      )
      .orderBy(calendarEvents.startDate)
      .limit(25);

    res.json(
      rows
        .filter(e => e.eventType !== "staff_training" && e.eventType !== "deadline")
        .map(e => ({
          id: String(e.id),
          title: e.title,
          date: e.startDate.toISOString(),
          type: e.eventType ?? "other",
        }))
    );
  });

  /**
   * Authenticated: notifications for this family (absence decisions,
   * announcements, …). Returns the latest 30 and marks them read — the
   * payload still carries each row's pre-fetch isRead so the UI can show
   * unread indicators once.
   */
  app.get("/api/family/notifications", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const rows = await db
      .select()
      .from(parentNotifications)
      .where(eq(parentNotifications.familyId, parent.familyId))
      .orderBy(desc(parentNotifications.createdAt))
      .limit(30);
    await db
      .update(parentNotifications)
      .set({ isRead: 1 })
      .where(eq(parentNotifications.familyId, parent.familyId));
    res.json(
      rows.map(n => ({
        id: String(n.id),
        message: n.message,
        type: n.type,
        isRead: n.isRead === 1,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  });

  /** Authenticated: is school open today? (weekends + holiday closures) */
  app.get("/api/family/school-status", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, parent.familyId))
      .limit(1);
    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

    const holidays = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.organizationId, family.organizationId),
          eq(calendarEvents.eventType, "holiday")
        )
      );
    const todayClosure = holidays.find(h => {
      const hStart = h.startDate;
      const hEnd = h.endDate ?? h.startDate;
      return hStart <= endOfDay && hEnd >= startOfDay;
    });
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const nextClosure = holidays
      .filter(h => h.startDate > endOfDay)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

    res.json({
      isOpen: !isWeekend && !todayClosure,
      label: todayClosure
        ? `Closed — ${todayClosure.title}`
        : isWeekend
          ? "Closed — Weekend"
          : "School is open today",
      nextClosureTitle: nextClosure?.title ?? null,
      nextClosureDate: nextClosure?.startDate.toISOString() ?? null,
    });
  });

  /**
   * Authenticated: progress graphs data — weekly attendance rate per child
   * over the last 8 weeks, and family goal progress.
   */
  app.get("/api/family/progress", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const kids = await db
      .select()
      .from(children)
      .where(eq(children.familyId, parent.familyId));
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, parent.familyId))
      .limit(1);

    const WEEKS = 8;
    const now = new Date();
    // Start of the current week (Sunday).
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    const windowStart = new Date(currentWeekStart);
    windowStart.setDate(windowStart.getDate() - 7 * (WEEKS - 1));

    const rows = family
      ? await db
          .select({ childId: attendance.childId, date: attendance.date, status: attendance.status })
          .from(attendance)
          .where(and(eq(attendance.organizationId, family.organizationId), gte(attendance.date, windowStart)))
      : [];
    const isPresent = (s: string | null) => s === "present" || s === "half_day";

    const series = kids.map(c => {
      const weeks: Array<{ weekStart: string; label: string; rate: number }> = [];
      for (let w = 0; w < WEEKS; w++) {
        const ws = new Date(windowStart);
        ws.setDate(ws.getDate() + 7 * w);
        const we = new Date(ws);
        we.setDate(we.getDate() + 7);
        const inWeek = rows.filter(r => r.childId === c.id && r.date >= ws && r.date < we);
        const rate = inWeek.length === 0
          ? -1 // no school days recorded that week
          : Math.round((inWeek.filter(r => isPresent(r.status)).length / inWeek.length) * 100);
        weeks.push({
          weekStart: dateOnly(ws),
          label: `${ws.getMonth() + 1}/${ws.getDate()}`,
          rate,
        });
      }
      return {
        childId: String(c.id),
        childName: `${c.firstName} ${c.lastName}`,
        weeks: weeks.filter(w => w.rate >= 0),
      };
    });

    const goals = await db
      .select()
      .from(familyGoals)
      .where(eq(familyGoals.familyId, parent.familyId))
      .orderBy(desc(familyGoals.updatedAt));

    res.json({
      attendance: series,
      goals: goals.map(g => ({
        id: String(g.id),
        title: g.title,
        progress: g.progress,
        status: g.status,
      })),
    });
  });

  // ---- Parent check-in / check-out (drop-off & pickup) ----

  /** Today's check-in/out state for each of the parent's children. */
  app.get("/api/family/attendance-today", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const kids = await db.select().from(children).where(eq(children.familyId, parent.familyId));
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const rows = await db
      .select()
      .from(attendance)
      .where(and(gte(attendance.date, start), lte(attendance.date, end)));
    const byChild = new Map(rows.map(r => [r.childId, r]));

    res.json(
      kids.map(c => {
        const r = byChild.get(c.id);
        return {
          childId: String(c.id),
          childName: `${c.firstName} ${c.lastName}`,
          status: r?.status ?? "none",
          checkInTime: r?.checkInTime?.toISOString() ?? null,
          checkOutTime: r?.checkOutTime?.toISOString() ?? null,
        };
      })
    );
  });

  // Shared guard: the child must belong to the signed-in parent's family.
  const requireOwnChild = async (parentFamilyId: number, childId: number) => {
    const db = await getDb();
    if (!db) return null;
    const [child] = await db
      .select()
      .from(children)
      .where(and(eq(children.id, childId), eq(children.familyId, parentFamilyId)))
      .limit(1);
    return child ?? null;
  };

  const upsertTodayAttendance = async (
    child: typeof children.$inferSelect,
    patch: { checkIn?: boolean; checkOut?: boolean }
  ) => {
    const db = await getDb();
    if (!db) return;
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const [existing] = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.childId, child.id), gte(attendance.date, start), lte(attendance.date, end)))
      .limit(1);
    if (existing) {
      await db
        .update(attendance)
        .set({
          status: "present",
          checkInTime: patch.checkIn ? existing.checkInTime ?? now : existing.checkInTime,
          checkOutTime: patch.checkOut ? now : existing.checkOutTime,
        })
        .where(eq(attendance.id, existing.id));
    } else {
      await db.insert(attendance).values({
        organizationId: child.organizationId,
        childId: child.id,
        date: now,
        status: "present",
        checkInTime: patch.checkIn ? now : null,
        checkOutTime: patch.checkOut ? now : null,
      });
    }
  };

  app.post("/api/family/check-in", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const child = await requireOwnChild(parent.familyId, Number(req.body?.childId));
    if (!child) {
      res.status(403).json({ error: "Child not found in your family" });
      return;
    }
    await upsertTodayAttendance(child, { checkIn: true });
    await insertAuditLog({
      userId: parent.id,
      actorOpenId: parent.openId,
      action: "update",
      resourceType: "attendance",
      resourceId: String(child.id),
      ipAddress: clientIpFromReq(req),
      detail: "parent check-in",
    });
    res.json({ success: true });
  });

  app.post("/api/family/check-out", async (req: Request, res: Response) => {
    const parent = await requireParent(req);
    if (!parent) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const child = await requireOwnChild(parent.familyId, Number(req.body?.childId));
    if (!child) {
      res.status(403).json({ error: "Child not found in your family" });
      return;
    }
    await upsertTodayAttendance(child, { checkOut: true });
    await insertAuditLog({
      userId: parent.id,
      actorOpenId: parent.openId,
      action: "update",
      resourceType: "attendance",
      resourceId: String(child.id),
      ipAddress: clientIpFromReq(req),
      detail: "parent check-out",
    });
    res.json({ success: true });
  });
}

import { and, desc, eq, gte } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  attendance,
  children,
  families,
  familyGoals,
  familyServices,
  healthRecords,
  organizations,
  type User,
} from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, getHealthFollowUpAlerts, insertAuditLog } from "./db";
import {
  assignChildToClassroom,
  getChildClassroomMap,
  getOrganizationClassrooms,
} from "./moduleDb";

/**
 * Children + classroom roster endpoints for the staff iOS app.
 *
 *   GET  /api/children            — all children with room, teacher, health,
 *                                   attendance and family contact info
 *   GET  /api/classrooms          — rooms with capacity, teacher, enrollment
 *   POST /api/children/:id/assign — move a child to a room (null = unassign)
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function registerRosterRoutes(app: Express) {
  app.get("/api/children", async (req: Request, res: Response) => {
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

    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      res.json([]);
      return;
    }

    const kids = await db.select().from(children).where(eq(children.organizationId, org.id));
    const familyRows = await db.select().from(families).where(eq(families.organizationId, org.id));
    const familyById = new Map(familyRows.map(f => [f.id, f]));

    const rooms = await getOrganizationClassrooms(org.id);
    const map = await getChildClassroomMap(org.id);
    const roomByChild = new Map(map.map(m => [m.childId, m]));
    const roomById = new Map(rooms.map(r => [r.id, r]));

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const attendanceRows = await db
      .select({ childId: attendance.childId, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.organizationId, org.id), gte(attendance.date, since)));
    const isPresent = (s: string | null) => s === "present" || s === "half_day";
    const rateFor = (childId: number): number => {
      const rows = attendanceRows.filter(r => r.childId === childId);
      if (rows.length === 0) return 100;
      return Math.round((rows.filter(r => isPresent(r.status)).length / rows.length) * 100);
    };

    const healthAlerts = await getHealthFollowUpAlerts(org.id, 30);
    const healthFor = (childId: number): string => {
      const alerts = healthAlerts.filter(a => a.childId === childId);
      if (alerts.some(a => a.severity === "overdue")) return "Action needed";
      if (alerts.length > 0) return "Due soon";
      return "Up to date";
    };

    res.json(
      kids.map(c => {
        const assignment = roomByChild.get(c.id);
        const room = assignment ? roomById.get(assignment.classroomId) : undefined;
        const family = c.familyId != null ? familyById.get(c.familyId) : undefined;
        return {
          id: String(c.id),
          familyId: c.familyId != null ? String(c.familyId) : null,
          firstName: c.firstName,
          lastName: c.lastName,
          dateOfBirth: c.dateOfBirth ? dateOnly(c.dateOfBirth) : "",
          gender: c.gender ?? "",
          // Not tracked in the schema yet; empty rather than invented.
          primaryLanguage: "",
          classroom: room?.name ?? "",
          teacher: room?.teacherName ?? "",
          enrollmentStatus: c.status ?? "active",
          healthStatus: healthFor(c.id),
          attendanceRate: rateFor(c.id),
          parentName: family?.primaryContactName ?? "",
          parentPhone: family?.primaryContactPhone ?? "",
          allergies: [] as string[],
        };
      })
    );
  });

  app.get("/api/classrooms", async (req: Request, res: Response) => {
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
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      res.json([]);
      return;
    }

    const rooms = await getOrganizationClassrooms(org.id);
    res.json(
      rooms
        .filter(r => r.isActive === 1)
        .map(r => ({
          id: String(r.id),
          name: r.name,
          ageGroup: r.ageGroup ?? "",
          capacity: r.capacity ?? 0,
          enrolledCount: r.enrolledCount,
          teacherName: r.teacherName ?? "",
          assistantName: r.assistantName ?? "",
          color: r.color ?? "#3b82f6",
        }))
    );
  });

  /** Families for the staff iOS app (Family Services hub + child→family links). */
  app.get("/api/families", async (req: Request, res: Response) => {
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
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      res.json([]);
      return;
    }

    const familyRows = await db.select().from(families).where(eq(families.organizationId, org.id));
    const kids = await db
      .select({ id: children.id, familyId: children.familyId })
      .from(children)
      .where(eq(children.organizationId, org.id));
    const services = await db
      .select()
      .from(familyServices)
      .where(eq(familyServices.organizationId, org.id))
      .orderBy(desc(familyServices.serviceDate));
    const goals = await db.select().from(familyGoals);

    const longDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    res.json(
      familyRows.map(f => {
        const lastService = services.find(s => s.familyId === f.id);
        const nextVisit = services
          .filter(s => s.familyId === f.id && s.followUpDate && s.followUpDate > new Date())
          .sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime())[0];
        return {
          id: String(f.id),
          name: f.primaryContactName,
          phone: f.primaryContactPhone ?? "",
          email: f.primaryContactEmail ?? "",
          address: [f.address, f.city, f.state].filter(Boolean).join(", "),
          childrenCount: kids.filter(k => k.familyId === f.id).length,
          lastContact: lastService ? longDate(lastService.serviceDate) : "No contact yet",
          nextHomeVisit: nextVisit?.followUpDate ? longDate(nextVisit.followUpDate) : "Not scheduled",
          goals: goals.filter(g => g.familyId === f.id).map(g => g.title),
        };
      })
    );
  });

  /**
   * Health records for the staff iOS app — every record tied to its child.
   * Category/status vocabulary matches what the app's Health module renders.
   */
  app.get("/api/health", async (req: Request, res: Response) => {
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
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      res.json([]);
      return;
    }

    const categoryMap: Record<string, string> = { immunization: "immunizations" };
    const statusMap: Record<string, string> = {
      up_to_date: "Current",
      due_soon: "Due Soon",
      overdue: "Overdue",
      exempt: "Current",
      not_required: "Current",
    };

    const rows = await db
      .select({ record: healthRecords, child: children })
      .from(healthRecords)
      .innerJoin(children, eq(healthRecords.childId, children.id))
      .where(eq(healthRecords.organizationId, org.id));

    res.json(
      rows.map(({ record, child }) => ({
        id: String(record.id),
        childId: String(child.id),
        childName: `${child.firstName} ${child.lastName}`,
        category: categoryMap[record.type] ?? record.type,
        status: statusMap[record.status ?? "up_to_date"] ?? "Current",
        dueDate: record.expiryDate?.toISOString() ?? null,
        completedDate: record.recordDate.toISOString(),
      }))
    );
  });

  app.post("/api/children/:id/assign", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const childId = Number(req.params.id);
    const raw = req.body?.classroomId;
    const classroomId = raw == null || raw === "" ? null : Number(raw);
    if (!childId || (classroomId != null && Number.isNaN(classroomId))) {
      res.status(400).json({ error: "Valid childId and classroomId are required" });
      return;
    }

    await assignChildToClassroom(childId, classroomId);
    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "child",
      resourceId: String(childId),
      ipAddress: clientIpFromReq(req),
      detail:
        classroomId != null
          ? `assigned to classroom ${classroomId}`
          : "unassigned from classroom",
    });
    res.json({ success: true });
  });
}

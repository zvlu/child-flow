import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  familyEngagementEvents,
  organizations,
  staff,
  type FamilyEngagementEventRow,
  type User,
} from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, insertAuditLog } from "./db";
import { resolveStaffId } from "./moduleDb";

/**
 * REST backing for the iOS staff app's family engagement Events screen
 * (parent orientations, family nights, workshops, health fairs, etc.).
 * Previously the client called endpoints that didn't exist server-side.
 *
 *   GET  /api/events        list events for the org, soonest planned date first
 *   POST /api/events        create an event
 *   POST /api/events/:id    update an event (iOS APIClient.updateEvent uses POST, not PUT)
 */

type ChecklistItem = { id: string; title: string; isComplete: boolean; notes: string };

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: typeof item?.id === "string" && item.id ? item.id : crypto.randomUUID(),
    title: typeof item?.title === "string" ? item.title : "",
    isComplete: Boolean(item?.isComplete),
    notes: typeof item?.notes === "string" ? item.notes : "",
  }));
}

/** The staff.id to attribute an event to, resolved to a display name for the client. */
async function resolveCreatedByName(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  organizationId: number,
  staffId: number | null
): Promise<string> {
  if (staffId != null) {
    const [row] = await db
      .select({ firstName: staff.firstName, lastName: staff.lastName })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1);
    if (row) return `${row.firstName} ${row.lastName}`;
  }
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org?.name ?? "";
}

function toClientEvent(row: FamilyEngagementEventRow, createdByName: string) {
  return {
    id: String(row.id),
    title: row.title,
    eventType: row.eventType,
    plannedDate: row.plannedDate,
    actualDate: row.actualDate,
    location: row.location ?? "",
    createdBy: createdByName,
    objectives: row.objectives ?? [],
    preEventChecklist: row.preEventChecklist ?? [],
    dayOfChecklist: row.dayOfChecklist ?? [],
    postEventChecklist: row.postEventChecklist ?? [],
    expectedAttendance: row.expectedAttendance ?? 0,
    actualAttendance: row.actualAttendance,
    notes: row.notes ?? "",
    status: row.status,
  };
}

export function registerFamilyEngagementEventsRoutes(app: Express) {
  app.get("/api/events", async (req: Request, res: Response) => {
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
    if (user.organizationId == null) {
      res.json([]);
      return;
    }
    const organizationId = user.organizationId;

    const rows = await db
      .select({ event: familyEngagementEvents, staffFirst: staff.firstName, staffLast: staff.lastName })
      .from(familyEngagementEvents)
      .leftJoin(staff, eq(familyEngagementEvents.createdBy, staff.id))
      .where(eq(familyEngagementEvents.organizationId, organizationId))
      .orderBy(familyEngagementEvents.plannedDate);

    let orgName: string | null = null;
    const events = [];
    for (const r of rows) {
      let createdByName = r.staffFirst && r.staffLast ? `${r.staffFirst} ${r.staffLast}` : "";
      if (!createdByName) {
        if (orgName === null) {
          const [org] = await db
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, organizationId))
            .limit(1);
          orgName = org?.name ?? "";
        }
        createdByName = orgName;
      }
      events.push(toClientEvent(r.event, createdByName));
    }

    res.json(events);
  });

  app.post("/api/events", async (req: Request, res: Response) => {
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
    if (user.organizationId == null) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    const organizationId = user.organizationId;

    const body = req.body ?? {};
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const eventType = typeof body.eventType === "string" ? body.eventType : "Other";
    const plannedDate = body.plannedDate ? new Date(body.plannedDate) : new Date();
    const actualDate = body.actualDate ? new Date(body.actualDate) : null;
    const location = typeof body.location === "string" ? body.location : "";
    const objectives = toStringArray(body.objectives);
    const preEventChecklist = toChecklist(body.preEventChecklist);
    const dayOfChecklist = toChecklist(body.dayOfChecklist);
    const postEventChecklist = toChecklist(body.postEventChecklist);
    const expectedAttendance = Number.isFinite(Number(body.expectedAttendance)) ? Number(body.expectedAttendance) : 0;
    const actualAttendance =
      body.actualAttendance === null || body.actualAttendance === undefined
        ? null
        : Number(body.actualAttendance);
    const notes = typeof body.notes === "string" ? body.notes : "";
    const status = typeof body.status === "string" ? body.status : "Planning";

    const staffId = await resolveStaffId(organizationId, user.id);

    const [result] = await db.insert(familyEngagementEvents).values({
      organizationId,
      title,
      eventType,
      plannedDate,
      actualDate,
      location,
      createdBy: staffId,
      objectives,
      preEventChecklist,
      dayOfChecklist,
      postEventChecklist,
      expectedAttendance,
      actualAttendance,
      notes,
      status,
    });
    const id = result.insertId;

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "family_engagement_event",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
    });

    const createdByName = await resolveCreatedByName(db, organizationId, staffId);
    res.json(
      toClientEvent(
        {
          id,
          organizationId,
          title,
          eventType,
          plannedDate,
          actualDate,
          location,
          createdBy: staffId,
          objectives,
          preEventChecklist,
          dayOfChecklist,
          postEventChecklist,
          expectedAttendance,
          actualAttendance,
          notes,
          status,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as FamilyEngagementEventRow,
        createdByName
      )
    );
  });

  // iOS APIClient.updateEvent posts to "events/:id" (POST, not PUT).
  app.post("/api/events/:id", async (req: Request, res: Response) => {
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
    if (user.organizationId == null) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    const organizationId = user.organizationId;

    const id = Number(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    // Scope the lookup to this org so a signed-in staff member from one
    // organization can't update another organization's event by guessing an id.
    const [existing] = await db
      .select()
      .from(familyEngagementEvents)
      .where(and(eq(familyEngagementEvents.id, id), eq(familyEngagementEvents.organizationId, organizationId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const body = req.body ?? {};
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title;
    const eventType = typeof body.eventType === "string" ? body.eventType : existing.eventType;
    const plannedDate = body.plannedDate ? new Date(body.plannedDate) : existing.plannedDate;
    const actualDate =
      body.actualDate === null || body.actualDate === undefined ? existing.actualDate : new Date(body.actualDate);
    const location = typeof body.location === "string" ? body.location : existing.location;
    const objectives = body.objectives !== undefined ? toStringArray(body.objectives) : existing.objectives ?? [];
    const preEventChecklist =
      body.preEventChecklist !== undefined ? toChecklist(body.preEventChecklist) : existing.preEventChecklist ?? [];
    const dayOfChecklist =
      body.dayOfChecklist !== undefined ? toChecklist(body.dayOfChecklist) : existing.dayOfChecklist ?? [];
    const postEventChecklist =
      body.postEventChecklist !== undefined ? toChecklist(body.postEventChecklist) : existing.postEventChecklist ?? [];
    const expectedAttendance =
      body.expectedAttendance !== undefined && Number.isFinite(Number(body.expectedAttendance))
        ? Number(body.expectedAttendance)
        : existing.expectedAttendance ?? 0;
    const actualAttendance =
      body.actualAttendance === null || body.actualAttendance === undefined
        ? existing.actualAttendance
        : Number(body.actualAttendance);
    const notes = typeof body.notes === "string" ? body.notes : existing.notes ?? "";
    const status = typeof body.status === "string" ? body.status : existing.status;

    await db
      .update(familyEngagementEvents)
      .set({
        title,
        eventType,
        plannedDate,
        actualDate,
        location,
        objectives,
        preEventChecklist,
        dayOfChecklist,
        postEventChecklist,
        expectedAttendance,
        actualAttendance,
        notes,
        status,
      })
      .where(and(eq(familyEngagementEvents.id, id), eq(familyEngagementEvents.organizationId, organizationId)));

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "family_engagement_event",
      resourceId: String(id),
      ipAddress: clientIpFromReq(req),
    });

    const [updated] = await db
      .select()
      .from(familyEngagementEvents)
      .where(eq(familyEngagementEvents.id, id))
      .limit(1);
    const createdByName = await resolveCreatedByName(db, organizationId, updated?.createdBy ?? existing.createdBy);
    res.json(toClientEvent(updated ?? existing, createdByName));
  });
}

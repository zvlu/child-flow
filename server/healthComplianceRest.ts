import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, insertAuditLog } from "./db";
import * as mod from "./moduleDb";
import {
  children,
  healthRecords,
  mentalHealthConsults,
  safetyDrillLogs,
  staff,
  type User,
} from "../drizzle/schema";

/**
 * REST backing for the native iOS staff app's HealthComplianceView.swift
 * screen (§1302.42 health compliance + safety drills + mental-health
 * consults). These endpoints previously didn't exist server-side, so the
 * app silently rendered "nothing due" — a false-negative risk for a federal
 * compliance screen. Not Head-Start-gated: every child-care program needs
 * this, same reasoning as attendance.ts.
 *
 *   GET  /api/health/compliance             per-child screening dates
 *   POST /api/health/compliance/:childId    record new screening date(s)
 *   GET  /api/health/drills                 safety drill log, newest first
 *   POST /api/health/drills                 log a drill
 *   GET  /api/health/consults               mental-health consult log, newest first
 *   POST /api/health/consults               log a consult
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

function reject(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

// The 5 screening types tracked on the compliance screen, and the iOS
// ChildHealthCompliance field each one feeds.
const SCREENING_FIELDS = [
  ["healthScreeningDate", "physical"],
  ["dentalScreeningDate", "dental"],
  ["visionScreeningDate", "vision"],
  ["hearingScreeningDate", "hearing"],
  ["developmentalScreeningDate", "developmental"],
] as const;
const SCREENING_TYPES = SCREENING_FIELDS.map(([, type]) => type);

export function registerHealthComplianceRoutes(app: Express) {
  // ---- Group 1: Health Compliance ----

  app.get("/api/health/compliance", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");

    const kids = await db
      .select({
        id: children.id,
        firstName: children.firstName,
        lastName: children.lastName,
        familyId: children.familyId,
        enrollmentDate: children.enrollmentDate,
        dateOfBirth: children.dateOfBirth,
      })
      .from(children)
      .where(and(eq(children.organizationId, orgId), eq(children.status, "active")))
      .orderBy(children.lastName, children.firstName);

    const kidIds = kids.map((k) => k.id);
    const records = kidIds.length
      ? await db
          .select({
            childId: healthRecords.childId,
            type: healthRecords.type,
            recordDate: healthRecords.recordDate,
          })
          .from(healthRecords)
          .where(
            and(
              eq(healthRecords.organizationId, orgId),
              inArray(healthRecords.childId, kidIds),
              inArray(healthRecords.type, SCREENING_TYPES)
            )
          )
      : [];

    // Most recent recordDate per (childId, type).
    const latest = new Map<number, Map<string, Date>>();
    for (const r of records) {
      if (!r.recordDate) continue;
      let byType = latest.get(r.childId);
      if (!byType) {
        byType = new Map();
        latest.set(r.childId, byType);
      }
      const d = new Date(r.recordDate);
      const cur = byType.get(r.type);
      if (!cur || d.getTime() > cur.getTime()) byType.set(r.type, d);
    }

    const items = kids.map((k) => {
      const byType = latest.get(k.id);
      const out: Record<string, unknown> = {
        childId: String(k.id),
        childName: `${k.firstName} ${k.lastName}`,
        familyId: k.familyId != null ? String(k.familyId) : "",
        enrollmentDate: k.enrollmentDate ?? k.dateOfBirth ?? new Date(),
        dateOfBirth: k.dateOfBirth ?? k.enrollmentDate ?? new Date(),
      };
      for (const [field, type] of SCREENING_FIELDS) {
        out[field] = byType?.get(type) ?? null;
      }
      return out;
    });

    res.json(items);
  });

  app.post("/api/health/compliance/:childId", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");

    const childId = Number(req.params.childId);
    if (!childId) return reject(res, 400, "Invalid childId");

    // The childId comes straight from the URL — verify it belongs to this
    // org before writing anything (same tenant-check pattern used by the
    // child-notes endpoint in attendance.ts).
    const [child] = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, childId), eq(children.organizationId, orgId)))
      .limit(1);
    if (!child) return reject(res, 404, "Child not found");

    // Fetch the current latest recordDate per type so we only write rows for
    // fields the caller actually changed (or newly added).
    const existingRecords = await db
      .select({ type: healthRecords.type, recordDate: healthRecords.recordDate })
      .from(healthRecords)
      .where(
        and(
          eq(healthRecords.organizationId, orgId),
          eq(healthRecords.childId, childId),
          inArray(healthRecords.type, SCREENING_TYPES)
        )
      );
    const existingLatestMs = new Map<string, number>();
    for (const r of existingRecords) {
      if (!r.recordDate) continue;
      const t = new Date(r.recordDate).getTime();
      const cur = existingLatestMs.get(r.type);
      if (cur === undefined || t > cur) existingLatestMs.set(r.type, t);
    }

    const recordedBy = await mod.resolveStaffId(orgId, user.id);
    let inserted = 0;
    for (const [field, type] of SCREENING_FIELDS) {
      const raw = (req.body as Record<string, unknown> | undefined)?.[field];
      if (raw == null) continue;
      const d = new Date(raw as string);
      if (Number.isNaN(d.getTime())) continue;
      const existingMs = existingLatestMs.get(type);
      if (existingMs !== undefined && existingMs === d.getTime()) continue; // unchanged

      await db.insert(healthRecords).values({
        childId,
        organizationId: orgId,
        type,
        recordDate: d,
        status: "up_to_date",
        recordedBy: recordedBy ?? undefined,
      });
      inserted += 1;
    }

    if (inserted > 0) {
      await insertAuditLog({
        userId: user.id,
        actorOpenId: user.openId,
        action: "create",
        resourceType: "health_record",
        resourceId: String(childId),
        ipAddress: clientIpFromReq(req),
        detail: `compliance update: ${inserted} screening field(s)`,
      });
    }
    res.json({ success: true });
  });

  // ---- Group 2: Safety Drills ----

  app.get("/api/health/drills", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");

    const rows = await db
      .select()
      .from(safetyDrillLogs)
      .where(eq(safetyDrillLogs.organizationId, orgId))
      .orderBy(desc(safetyDrillLogs.drillDate));

    const staffIds = Array.from(
      new Set(rows.map((r) => r.conductedBy).filter((id): id is number => id != null))
    );
    const staffRows = staffIds.length
      ? await db
          .select({ id: staff.id, firstName: staff.firstName, lastName: staff.lastName })
          .from(staff)
          .where(inArray(staff.id, staffIds))
      : [];
    const nameByStaffId = new Map(staffRows.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        drillType: r.drillType,
        drillDate: r.drillDate,
        conductedBy: r.conductedBy != null ? nameByStaffId.get(r.conductedBy) ?? "" : "",
        durationMinutes: r.durationMinutes,
        participantCount: r.participantCount,
        notes: r.notes ?? "",
        issuesFound: r.issuesFound ?? "",
        resolvedDate: r.resolvedDate,
      }))
    );
  });

  app.post("/api/health/drills", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");

    const drillType = String(req.body?.drillType ?? "").trim();
    const drillDate = req.body?.drillDate ? new Date(req.body.drillDate) : null;
    if (!drillType || !drillDate || Number.isNaN(drillDate.getTime())) {
      return reject(res, 400, "drillType and drillDate are required");
    }

    // iOS sends `conductedBy` as a display name, but the column is a staff
    // FK. Rather than fuzzy-matching a free-text name to a staff row, record
    // the staff member actually submitting the log (cheap + reliable — the
    // person logging a drill is almost always the one who ran it); GET
    // resolves the name back via join.
    const conductedBy = await mod.resolveStaffId(orgId, user.id);

    const durationMinutes = Number.isFinite(Number(req.body?.durationMinutes))
      ? Number(req.body.durationMinutes)
      : 0;
    const participantCount = Number.isFinite(Number(req.body?.participantCount))
      ? Number(req.body.participantCount)
      : 0;

    const [result] = await db.insert(safetyDrillLogs).values({
      organizationId: orgId,
      drillType,
      drillDate,
      conductedBy: conductedBy ?? undefined,
      durationMinutes,
      participantCount,
      notes: req.body?.notes != null ? String(req.body.notes) : null,
      issuesFound: req.body?.issuesFound != null ? String(req.body.issuesFound) : null,
      resolvedDate: req.body?.resolvedDate ? new Date(req.body.resolvedDate) : null,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "safety_drill_log",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  // ---- Group 3: Mental Health Consults ----

  app.get("/api/health/consults", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return void res.json([]);
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");

    const rows = await db
      .select()
      .from(mentalHealthConsults)
      .where(eq(mentalHealthConsults.organizationId, orgId))
      .orderBy(desc(mentalHealthConsults.consultDate));

    const childIds = Array.from(
      new Set(rows.map((r) => r.childId).filter((id): id is number => id != null))
    );
    const childRows = childIds.length
      ? await db
          .select({ id: children.id, firstName: children.firstName, lastName: children.lastName })
          .from(children)
          .where(inArray(children.id, childIds))
      : [];
    const nameByChildId = new Map(childRows.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        childId: r.childId != null ? String(r.childId) : null,
        childName: r.childId != null ? nameByChildId.get(r.childId) ?? null : null,
        consultDate: r.consultDate,
        consultantName: r.consultantName,
        consultType: r.consultType,
        summary: r.summary ?? "",
        followUpDate: r.followUpDate,
        followUpNotes: r.followUpNotes ?? "",
      }))
    );
  });

  app.post("/api/health/consults", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");
    const db = await getDb();
    if (!db) return reject(res, 500, "Database not available");

    const consultDate = req.body?.consultDate ? new Date(req.body.consultDate) : null;
    const consultantName = String(req.body?.consultantName ?? "").trim();
    const consultType = String(req.body?.consultType ?? "").trim();
    if (!consultDate || Number.isNaN(consultDate.getTime()) || !consultantName || !consultType) {
      return reject(res, 400, "consultDate, consultantName, and consultType are required");
    }

    let childId: number | null = null;
    const rawChildId = req.body?.childId;
    if (rawChildId != null && String(rawChildId).trim() !== "") {
      const cid = Number(rawChildId);
      if (!Number.isFinite(cid)) return reject(res, 400, "Invalid childId");
      // Program-level consults have no childId; when one is given it must
      // belong to this org (same tenant-check pattern as the notes endpoint
      // in attendance.ts).
      const [child] = await db
        .select({ id: children.id })
        .from(children)
        .where(and(eq(children.id, cid), eq(children.organizationId, orgId)))
        .limit(1);
      if (!child) return reject(res, 404, "Child not found");
      childId = cid;
    }

    const recordedBy = await mod.resolveStaffId(orgId, user.id);
    const [result] = await db.insert(mentalHealthConsults).values({
      organizationId: orgId,
      childId,
      consultDate,
      consultantName,
      consultType,
      summary: req.body?.summary != null ? String(req.body.summary) : null,
      followUpDate: req.body?.followUpDate ? new Date(req.body.followUpDate) : null,
      followUpNotes: req.body?.followUpNotes != null ? String(req.body.followUpNotes) : null,
      recordedBy: recordedBy ?? undefined,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "mental_health_consult",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

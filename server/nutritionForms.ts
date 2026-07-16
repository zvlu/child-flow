import { and, desc, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  children,
  nutritionInfantFormulaForms,
  nutritionMedicalStatements,
  nutritionPreferenceForms,
  type User,
} from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, insertAuditLog } from "./db";

/**
 * REST backing for the iOS Nutrition Forms screen (CACFP §226 meal-program
 * recordkeeping). Previously the screen only called endpoints that didn't
 * exist. These are general child-care CACFP forms — not Head-Start-gated —
 * so any signed-in staff/admin in the child's organization can read/write.
 *
 *   GET  /api/nutrition/preferences?childId=        food preference forms
 *   POST /api/nutrition/preferences                  create one
 *   GET  /api/nutrition/infant-formula?childId=      infant formula forms
 *   POST /api/nutrition/infant-formula                create one
 *   GET  /api/nutrition/medical-statements?childId=  medical statements
 *   POST /api/nutrition/medical-statements            create one
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

/**
 * Parses the optional `?childId=` query param. Returns `undefined` when
 * omitted (the list screens browse ALL children's forms, not one child's —
 * this used to be required, which made every list-view load 400 since the
 * iOS list view models call these routes with no child selected yet) or
 * `null` (writing a 400) if present but not a valid positive number.
 */
function parseChildIdQuery(req: Request, res: Response): number | null | undefined {
  const raw = req.query.childId;
  if (raw === undefined || raw === "") return undefined;
  const childId = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(childId) || childId <= 0) {
    res.status(400).json({ error: "childId, if provided, must be a positive number" });
    return null;
  }
  return childId;
}

/**
 * Confirms the childId in a POST body belongs to the caller's organization.
 * Returns the child row (with name) or null (and writes a 404) if not found.
 * Mirrors the org-scoping fix used by server/attendance.ts's notes endpoint.
 */
async function requireOrgChild(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  organizationId: number,
  childId: number,
  res: Response
): Promise<{ id: number; firstName: string; lastName: string } | null> {
  const [child] = await db
    .select({ id: children.id, firstName: children.firstName, lastName: children.lastName })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.organizationId, organizationId)))
    .limit(1);
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return null;
  }
  return child;
}

export function registerNutritionFormRoutes(app: Express) {
  // ---------------------------------------------------------------------
  // Preference forms
  // ---------------------------------------------------------------------
  app.get("/api/nutrition/preferences", async (req: Request, res: Response) => {
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
    const childId = parseChildIdQuery(req, res);
    if (childId === null) return;

    const rows = await db
      .select({
        id: nutritionPreferenceForms.id,
        childId: nutritionPreferenceForms.childId,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        classroom: nutritionPreferenceForms.classroom,
        completedDate: nutritionPreferenceForms.completedDate,
        parentName: nutritionPreferenceForms.parentName,
        preferences: nutritionPreferenceForms.preferences,
        notes: nutritionPreferenceForms.notes,
      })
      .from(nutritionPreferenceForms)
      .innerJoin(children, eq(children.id, nutritionPreferenceForms.childId))
      .where(
        childId === undefined
          ? eq(nutritionPreferenceForms.organizationId, org.id)
          : and(eq(nutritionPreferenceForms.organizationId, org.id), eq(nutritionPreferenceForms.childId, childId))
      )
      .orderBy(desc(nutritionPreferenceForms.completedDate));

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        childId: String(r.childId),
        childName: `${r.childFirstName} ${r.childLastName}`,
        classroom: r.classroom ?? "",
        completedDate: r.completedDate,
        parentName: r.parentName ?? "",
        preferences: r.preferences ?? [],
        notes: r.notes ?? "",
      }))
    );
  });

  app.post("/api/nutrition/preferences", async (req: Request, res: Response) => {
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
      res.status(404).json({ error: "Child not found" });
      return;
    }

    const childId = Number(req.body?.childId);
    const completedDateRaw = req.body?.completedDate;
    const completedDate = typeof completedDateRaw === "string" || completedDateRaw instanceof Date
      ? new Date(completedDateRaw)
      : null;
    if (!childId || !completedDate || Number.isNaN(completedDate.getTime())) {
      res.status(400).json({ error: "childId and completedDate are required" });
      return;
    }

    const child = await requireOrgChild(db, org.id, childId, res);
    if (!child) return;

    const preferences = Array.isArray(req.body?.preferences) ? req.body.preferences : [];

    const [result] = await db.insert(nutritionPreferenceForms).values({
      organizationId: org.id,
      childId,
      classroom: typeof req.body?.classroom === "string" ? req.body.classroom : null,
      completedDate,
      parentName: typeof req.body?.parentName === "string" ? req.body.parentName : null,
      preferences,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "nutrition_preference_form",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------
  // Infant formula forms
  // ---------------------------------------------------------------------
  app.get("/api/nutrition/infant-formula", async (req: Request, res: Response) => {
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
    const childId = parseChildIdQuery(req, res);
    if (childId === null) return;

    const rows = await db
      .select({
        id: nutritionInfantFormulaForms.id,
        childId: nutritionInfantFormulaForms.childId,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        classroom: nutritionInfantFormulaForms.classroom,
        completedDate: nutritionInfantFormulaForms.completedDate,
        parentName: nutritionInfantFormulaForms.parentName,
        formulaBrand: nutritionInfantFormulaForms.formulaBrand,
        formulaType: nutritionInfantFormulaForms.formulaType,
        preparationInstructions: nutritionInfantFormulaForms.preparationInstructions,
        feedingSchedule: nutritionInfantFormulaForms.feedingSchedule,
        notes: nutritionInfantFormulaForms.notes,
      })
      .from(nutritionInfantFormulaForms)
      .innerJoin(children, eq(children.id, nutritionInfantFormulaForms.childId))
      .where(
        childId === undefined
          ? eq(nutritionInfantFormulaForms.organizationId, org.id)
          : and(eq(nutritionInfantFormulaForms.organizationId, org.id), eq(nutritionInfantFormulaForms.childId, childId))
      )
      .orderBy(desc(nutritionInfantFormulaForms.completedDate));

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        childId: String(r.childId),
        childName: `${r.childFirstName} ${r.childLastName}`,
        classroom: r.classroom ?? "",
        completedDate: r.completedDate,
        parentName: r.parentName ?? "",
        formulaBrand: r.formulaBrand ?? "",
        formulaType: r.formulaType ?? "",
        preparationInstructions: r.preparationInstructions ?? "",
        feedingSchedule: r.feedingSchedule ?? "",
        notes: r.notes ?? "",
      }))
    );
  });

  app.post("/api/nutrition/infant-formula", async (req: Request, res: Response) => {
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
      res.status(404).json({ error: "Child not found" });
      return;
    }

    const childId = Number(req.body?.childId);
    const completedDateRaw = req.body?.completedDate;
    const completedDate = typeof completedDateRaw === "string" || completedDateRaw instanceof Date
      ? new Date(completedDateRaw)
      : null;
    if (!childId || !completedDate || Number.isNaN(completedDate.getTime())) {
      res.status(400).json({ error: "childId and completedDate are required" });
      return;
    }

    const child = await requireOrgChild(db, org.id, childId, res);
    if (!child) return;

    const [result] = await db.insert(nutritionInfantFormulaForms).values({
      organizationId: org.id,
      childId,
      classroom: typeof req.body?.classroom === "string" ? req.body.classroom : null,
      completedDate,
      parentName: typeof req.body?.parentName === "string" ? req.body.parentName : null,
      formulaBrand: typeof req.body?.formulaBrand === "string" ? req.body.formulaBrand : null,
      formulaType: typeof req.body?.formulaType === "string" ? req.body.formulaType : null,
      preparationInstructions: typeof req.body?.preparationInstructions === "string" ? req.body.preparationInstructions : null,
      feedingSchedule: typeof req.body?.feedingSchedule === "string" ? req.body.feedingSchedule : null,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "nutrition_infant_formula_form",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------
  // Medical statements
  // ---------------------------------------------------------------------
  app.get("/api/nutrition/medical-statements", async (req: Request, res: Response) => {
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
    const childId = parseChildIdQuery(req, res);
    if (childId === null) return;

    const rows = await db
      .select({
        id: nutritionMedicalStatements.id,
        childId: nutritionMedicalStatements.childId,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        classroom: nutritionMedicalStatements.classroom,
        physicianName: nutritionMedicalStatements.physicianName,
        physicianPhone: nutritionMedicalStatements.physicianPhone,
        diagnosis: nutritionMedicalStatements.diagnosis,
        foodsToAvoid: nutritionMedicalStatements.foodsToAvoid,
        substitutions: nutritionMedicalStatements.substitutions,
        signedDate: nutritionMedicalStatements.signedDate,
        notes: nutritionMedicalStatements.notes,
      })
      .from(nutritionMedicalStatements)
      .innerJoin(children, eq(children.id, nutritionMedicalStatements.childId))
      .where(
        childId === undefined
          ? eq(nutritionMedicalStatements.organizationId, org.id)
          : and(eq(nutritionMedicalStatements.organizationId, org.id), eq(nutritionMedicalStatements.childId, childId))
      )
      .orderBy(desc(nutritionMedicalStatements.signedDate));

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        childId: String(r.childId),
        childName: `${r.childFirstName} ${r.childLastName}`,
        classroom: r.classroom ?? "",
        physicianName: r.physicianName ?? "",
        physicianPhone: r.physicianPhone ?? "",
        diagnosis: r.diagnosis ?? "",
        foodsToAvoid: r.foodsToAvoid ?? [],
        substitutions: r.substitutions ?? "",
        signedDate: r.signedDate,
        notes: r.notes ?? "",
      }))
    );
  });

  app.post("/api/nutrition/medical-statements", async (req: Request, res: Response) => {
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
      res.status(404).json({ error: "Child not found" });
      return;
    }

    const childId = Number(req.body?.childId);
    const signedDateRaw = req.body?.signedDate;
    const signedDate = typeof signedDateRaw === "string" || signedDateRaw instanceof Date
      ? new Date(signedDateRaw)
      : null;
    if (!childId || !signedDate || Number.isNaN(signedDate.getTime())) {
      res.status(400).json({ error: "childId and signedDate are required" });
      return;
    }

    const child = await requireOrgChild(db, org.id, childId, res);
    if (!child) return;

    const foodsToAvoid = Array.isArray(req.body?.foodsToAvoid)
      ? req.body.foodsToAvoid.filter((f: unknown): f is string => typeof f === "string")
      : [];

    const [result] = await db.insert(nutritionMedicalStatements).values({
      organizationId: org.id,
      childId,
      classroom: typeof req.body?.classroom === "string" ? req.body.classroom : null,
      physicianName: typeof req.body?.physicianName === "string" ? req.body.physicianName : null,
      physicianPhone: typeof req.body?.physicianPhone === "string" ? req.body.physicianPhone : null,
      diagnosis: typeof req.body?.diagnosis === "string" ? req.body.diagnosis : null,
      foodsToAvoid,
      substitutions: typeof req.body?.substitutions === "string" ? req.body.substitutions : null,
      signedDate,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "nutrition_medical_statement",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });
    res.json({ success: true });
  });
}

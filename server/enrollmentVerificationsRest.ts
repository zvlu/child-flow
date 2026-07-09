import { and, desc, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { applicationVerifications } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { getEnrollmentApplications } from "./moduleDb";

// Real DB enum values -> the display strings the iOS EnrollmentApplication
// model expects (used for filtering/badges). "reviewing" maps to "Under
// Review" to match the labels already used elsewhere in the iOS app.
const ENROLLMENT_STATUS_TO_IOS: Record<string, string> = {
  pending: "Pending",
  reviewing: "Under Review",
  approved: "Approved",
  denied: "Denied",
  enrolled: "Enrolled",
};

/**
 * REST mirror for the iOS "Application Verification" checklist (ERSEA
 * eligibility document tracking):
 *   GET  /api/enrollment/verifications        — list, newest first
 *   POST /api/enrollment/verifications/:id     — create or update (upsert)
 *
 * This previously had no backend route at all — every load fell back to a
 * #if DEBUG mock (or empty in release) and every save silently failed. The
 * checklist itself (primaryAdult/secondaryAdult/childChecklist) is stored as
 * opaque JSON exactly as the iOS app encodes it; the server doesn't need to
 * understand its internal shape, just persist and return it.
 */

async function requireStaff(req: Request) {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

function serialize(row: typeof applicationVerifications.$inferSelect) {
  return {
    id: row.id,
    childName: row.childName,
    applicationDate: row.applicationDate.toISOString(),
    verifiedBy: row.verifiedBy,
    verifiedDate: row.verifiedDate ? row.verifiedDate.toISOString() : null,
    primaryAdult: row.primaryAdult,
    secondaryAdult: row.secondaryAdult,
    childChecklist: row.childChecklist,
    status: row.status,
    notes: row.notes ?? "",
  };
}

export function registerEnrollmentVerificationRoutes(app: Express) {
  /**
   * Enrollment application roster (read-only summary — this previously had
   * no backend route at all, so every load failed). `priority` is passed
   * through as the DB's real high/medium/low value rather than the
   * categorical labels ("Income-Eligible", "Foster Child", etc.) the debug
   * mock uses — those categories aren't tracked anywhere in the schema yet,
   * so inventing them here would just be fabricating data under a different
   * name. Status changes / classroom assignment aren't wired yet either;
   * those exist as real tRPC mutations (enrollment.setStatus, .enroll) but
   * need a REST mirror + a decision on how "priority" should reconcile
   * between the rank the DB stores and the eligibility category iOS shows.
   */
  app.get("/api/enrollment", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const rows = await getEnrollmentApplications(user.organizationId);
    res.json(
      rows.map(r => ({
        id: String(r.id),
        childName: `${r.childFirstName} ${r.childLastName}`,
        status: ENROLLMENT_STATUS_TO_IOS[r.status] ?? "Pending",
        applicationDate: r.appliedDate.toISOString(),
        priority: r.priority,
        classroom: null,
      }))
    );
  });

  app.get("/api/enrollment/verifications", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
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
      .from(applicationVerifications)
      .where(eq(applicationVerifications.organizationId, user.organizationId))
      .orderBy(desc(applicationVerifications.applicationDate));
    res.json(rows.map(serialize));
  });

  app.post("/api/enrollment/verifications/:id", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const id = String(req.params.id);
    const childName = typeof req.body?.childName === "string" ? req.body.childName : "";
    if (!id || !childName) {
      res.status(400).json({ error: "id and childName are required" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    // Upsert scoped to this org — an id from another org can't overwrite here
    // because the WHERE clause on update requires organizationId to match, and
    // insert always stamps the caller's own org.
    const [existing] = await db
      .select({ id: applicationVerifications.id })
      .from(applicationVerifications)
      .where(and(eq(applicationVerifications.id, id), eq(applicationVerifications.organizationId, user.organizationId)))
      .limit(1);

    const values = {
      childName,
      applicationDate: req.body?.applicationDate ? new Date(req.body.applicationDate) : new Date(),
      verifiedBy: typeof req.body?.verifiedBy === "string" ? req.body.verifiedBy : "",
      verifiedDate: req.body?.verifiedDate ? new Date(req.body.verifiedDate) : null,
      primaryAdult: req.body?.primaryAdult ?? {},
      secondaryAdult: req.body?.secondaryAdult ?? null,
      childChecklist: req.body?.childChecklist ?? {},
      status: ["Pending", "In Progress", "Complete", "Needs Info"].includes(req.body?.status)
        ? req.body.status
        : "Pending",
      notes: typeof req.body?.notes === "string" ? req.body.notes : "",
    };

    if (existing) {
      await db
        .update(applicationVerifications)
        .set(values)
        .where(and(eq(applicationVerifications.id, id), eq(applicationVerifications.organizationId, user.organizationId)));
    } else {
      await db.insert(applicationVerifications).values({ id, organizationId: user.organizationId, ...values });
    }

    const [saved] = await db
      .select()
      .from(applicationVerifications)
      .where(eq(applicationVerifications.id, id))
      .limit(1);
    res.json(serialize(saved!));
  });
}

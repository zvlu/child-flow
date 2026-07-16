import { and, desc, eq } from "drizzle-orm";
import { children, disabilityServices, type DisabilityService } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * IEP/IFSP coordination (§1302.60–63). Federal law reserves at least 10% of
 * enrollment for children with disabilities; this module tracks the plans,
 * their annual-review deadlines, LEA coordination, and transition planning.
 */

export interface DisabilityRecordWithChild extends DisabilityService {
  childName: string;
}

export interface DisabilitySummary {
  activeEnrollment: number;
  childrenWithPlans: number;
  pctOfEnrollment: number; // 0–100
  meetsTenPercent: boolean;
  expiringSoon: number; // within 30 days
  parentRightsPending: number;
  records: DisabilityRecordWithChild[];
}

export async function getDisabilitySummary(organizationId: number): Promise<DisabilitySummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [kids, rows] = await Promise.all([
    db
      .select({ id: children.id, status: children.status })
      .from(children)
      .where(eq(children.organizationId, organizationId)),
    db
      .select({ rec: disabilityServices, firstName: children.firstName, lastName: children.lastName })
      .from(disabilityServices)
      .innerJoin(
        children,
        and(eq(disabilityServices.childId, children.id), eq(children.organizationId, organizationId))
      )
      .where(eq(disabilityServices.organizationId, organizationId))
      .orderBy(desc(disabilityServices.updatedAt)),
  ]);

  const records = rows.map((r) => ({ ...r.rec, childName: `${r.firstName} ${r.lastName}` }));
  const activeEnrollment = kids.filter((k) => k.status === "active").length;
  const activePlans = records.filter((r) => r.status === "active" || r.status === "pending_evaluation");
  const withPlans = new Set(activePlans.map((r) => r.childId)).size;
  const pct = activeEnrollment > 0 ? Math.round((withPlans / activeEnrollment) * 100) : 0;

  const now = Date.now();
  const in30 = now + 30 * 24 * 3600 * 1000;
  const expiringSoon = activePlans.filter(
    (r) => r.expirationDate && r.expirationDate.getTime() > now && r.expirationDate.getTime() <= in30
  ).length;

  return {
    activeEnrollment,
    childrenWithPlans: withPlans,
    pctOfEnrollment: pct,
    meetsTenPercent: activeEnrollment > 0 && withPlans / activeEnrollment >= 0.1,
    expiringSoon,
    parentRightsPending: activePlans.filter((r) => !r.parentRightsNotifiedAt).length,
    records,
  };
}

export async function upsertDisabilityRecord(input: {
  id?: number | null;
  organizationId: number;
  childId: number;
  planType: DisabilityService["planType"];
  status?: DisabilityService["status"];
  primaryDisability?: string | null;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  leaAgency?: string | null;
  leaContact?: string | null;
  notes?: string | null;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (input.id) {
    await db
      .update(disabilityServices)
      .set({
        planType: input.planType,
        ...(input.status !== undefined && { status: input.status }),
        ...(input.primaryDisability !== undefined && { primaryDisability: input.primaryDisability }),
        ...(input.effectiveDate !== undefined && { effectiveDate: input.effectiveDate }),
        ...(input.expirationDate !== undefined && { expirationDate: input.expirationDate }),
        ...(input.leaAgency !== undefined && { leaAgency: input.leaAgency }),
        ...(input.leaContact !== undefined && { leaContact: input.leaContact }),
        ...(input.notes !== undefined && { notes: input.notes }),
      })
      .where(
        and(eq(disabilityServices.id, input.id), eq(disabilityServices.organizationId, input.organizationId))
      );
    return { id: input.id };
  }

  // Tenancy: the child must belong to the caller's organization.
  const [child] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, input.childId), eq(children.organizationId, input.organizationId)))
    .limit(1);
  if (!child) throw new Error("Child not found in this organization");

  const [result] = await db.insert(disabilityServices).values({
    organizationId: input.organizationId,
    childId: input.childId,
    planType: input.planType,
    status: input.status ?? "active",
    primaryDisability: input.primaryDisability ?? null,
    effectiveDate: input.effectiveDate ?? null,
    expirationDate: input.expirationDate ?? null,
    leaAgency: input.leaAgency ?? null,
    leaContact: input.leaContact ?? null,
    notes: input.notes ?? null,
    transitionChecklist: [],
  });
  return { id: result.insertId };
}

export async function markParentRights(input: {
  id: number;
  organizationId: number;
  language: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(disabilityServices)
    .set({ parentRightsNotifiedAt: new Date(), parentRightsLanguage: input.language })
    .where(
      and(eq(disabilityServices.id, input.id), eq(disabilityServices.organizationId, input.organizationId))
    );
}

export async function setTransitionChecklist(input: {
  id: number;
  organizationId: number;
  steps: string[];
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(disabilityServices)
    .set({ transitionChecklist: input.steps })
    .where(
      and(eq(disabilityServices.id, input.id), eq(disabilityServices.organizationId, input.organizationId))
    );
}

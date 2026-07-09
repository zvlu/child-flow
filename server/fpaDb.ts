import { and, desc, eq } from "drizzle-orm";
import {
  familyGoals,
  familyPartnershipAgreements,
  familyServices,
  families,
  type FamilyPartnershipAgreement,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Family Partnership Agreements (Head Start §1302.52) — web admin portal.
 * Goals live in family_goals; home visits in family_services (home_visit).
 * This module ties them together per family with an agreement row.
 */

export interface FpaListItem {
  id: number | null; // null = family has no agreement yet
  familyId: number;
  familyName: string;
  status: FamilyPartnershipAgreement["status"] | "none";
  goalsTotal: number;
  goalsCompleted: number;
  visitsLogged: number;
  targetVisits: number;
  parentSigned: boolean;
  staffSigned: boolean;
  reviewDate: string | null;
  updatedAt: string | null;
}

export async function listFpas(organizationId: number): Promise<FpaListItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const familyRows = await db
    .select({ id: families.id, name: families.primaryContactName })
    .from(families)
    .where(eq(families.organizationId, organizationId));

  const fpaRows = await db
    .select()
    .from(familyPartnershipAgreements)
    .where(eq(familyPartnershipAgreements.organizationId, organizationId))
    .orderBy(desc(familyPartnershipAgreements.updatedAt));

  const goalRows = await db
    .select({
      familyId: familyGoals.familyId,
      status: familyGoals.status,
    })
    .from(familyGoals)
    .innerJoin(families, eq(familyGoals.familyId, families.id))
    .where(eq(families.organizationId, organizationId));

  const visitRows = await db
    .select({ familyId: familyServices.familyId })
    .from(familyServices)
    .where(
      and(
        eq(familyServices.organizationId, organizationId),
        eq(familyServices.type, "home_visit")
      )
    );

  const goalsByFamily = new Map<number, { total: number; completed: number }>();
  for (const g of goalRows) {
    const acc = goalsByFamily.get(g.familyId) ?? { total: 0, completed: 0 };
    acc.total += 1;
    if (g.status === "completed") acc.completed += 1;
    goalsByFamily.set(g.familyId, acc);
  }

  const visitsByFamily = new Map<number, number>();
  for (const v of visitRows) {
    visitsByFamily.set(v.familyId, (visitsByFamily.get(v.familyId) ?? 0) + 1);
  }

  // Latest agreement per family.
  const fpaByFamily = new Map<number, FamilyPartnershipAgreement>();
  for (const f of fpaRows) {
    if (!fpaByFamily.has(f.familyId)) fpaByFamily.set(f.familyId, f);
  }

  return familyRows.map((fam) => {
    const fpa = fpaByFamily.get(fam.id);
    const goals = goalsByFamily.get(fam.id) ?? { total: 0, completed: 0 };
    return {
      id: fpa?.id ?? null,
      familyId: fam.id,
      familyName: fam.name,
      status: fpa?.status ?? "none",
      goalsTotal: goals.total,
      goalsCompleted: goals.completed,
      visitsLogged: visitsByFamily.get(fam.id) ?? 0,
      targetVisits: fpa?.targetVisits ?? 2,
      parentSigned: (fpa?.parentSigned ?? 0) === 1,
      staffSigned: (fpa?.staffSigned ?? 0) === 1,
      reviewDate: fpa?.reviewDate ? fpa.reviewDate.toISOString() : null,
      updatedAt: fpa?.updatedAt ? fpa.updatedAt.toISOString() : null,
    };
  });
}

export interface FpaDetail {
  agreement: FamilyPartnershipAgreement | null;
  familyName: string;
  goals: Array<{
    id: number;
    title: string;
    progress: number;
    status: "not_started" | "in_progress" | "completed" | "on_hold";
  }>;
  visits: Array<{
    id: number;
    serviceDate: string;
    description: string;
    outcome: string | null;
  }>;
}

export async function getFpaDetail(
  organizationId: number,
  familyId: number
): Promise<FpaDetail | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [family] = await db
    .select({ id: families.id, name: families.primaryContactName })
    .from(families)
    .where(and(eq(families.id, familyId), eq(families.organizationId, organizationId)));
  if (!family) return null;

  const [agreement] = await db
    .select()
    .from(familyPartnershipAgreements)
    .where(
      and(
        eq(familyPartnershipAgreements.familyId, familyId),
        eq(familyPartnershipAgreements.organizationId, organizationId)
      )
    )
    .orderBy(desc(familyPartnershipAgreements.updatedAt))
    .limit(1);

  const goals = await db
    .select({
      id: familyGoals.id,
      title: familyGoals.title,
      progress: familyGoals.progress,
      status: familyGoals.status,
    })
    .from(familyGoals)
    .where(eq(familyGoals.familyId, familyId))
    .orderBy(desc(familyGoals.updatedAt));

  const visits = await db
    .select({
      id: familyServices.id,
      serviceDate: familyServices.serviceDate,
      description: familyServices.description,
      outcome: familyServices.outcome,
    })
    .from(familyServices)
    .where(
      and(
        eq(familyServices.familyId, familyId),
        eq(familyServices.organizationId, organizationId),
        eq(familyServices.type, "home_visit")
      )
    )
    .orderBy(desc(familyServices.serviceDate));

  return {
    agreement: agreement ?? null,
    familyName: family.name,
    goals,
    visits: visits.map((v) => ({
      id: v.id,
      serviceDate: v.serviceDate.toISOString(),
      description: v.description,
      outcome: v.outcome,
    })),
  };
}

export interface UpsertFpaInput {
  organizationId: number;
  familyId: number;
  status?: FamilyPartnershipAgreement["status"];
  strengths?: string[];
  needsAssessment?: string | null;
  targetVisits?: number;
  reviewDate?: Date | null;
  parentSigned?: boolean;
  staffSigned?: boolean;
  createdBy?: number | null;
}

export async function upsertFpa(input: UpsertFpaInput): Promise<FamilyPartnershipAgreement> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Tenancy: the family must belong to the caller's organization.
  const [family] = await db
    .select({ id: families.id })
    .from(families)
    .where(and(eq(families.id, input.familyId), eq(families.organizationId, input.organizationId)))
    .limit(1);
  if (!family) throw new Error("Family not found in this organization");

  const [existing] = await db
    .select()
    .from(familyPartnershipAgreements)
    .where(
      and(
        eq(familyPartnershipAgreements.familyId, input.familyId),
        eq(familyPartnershipAgreements.organizationId, input.organizationId)
      )
    )
    .orderBy(desc(familyPartnershipAgreements.updatedAt))
    .limit(1);

  const now = new Date();
  const values = {
    ...(input.status !== undefined && { status: input.status }),
    ...(input.strengths !== undefined && { strengths: input.strengths }),
    ...(input.needsAssessment !== undefined && { needsAssessment: input.needsAssessment }),
    ...(input.targetVisits !== undefined && { targetVisits: input.targetVisits }),
    ...(input.reviewDate !== undefined && { reviewDate: input.reviewDate }),
    ...(input.parentSigned !== undefined && {
      parentSigned: input.parentSigned ? 1 : 0,
      parentSignedAt: input.parentSigned ? now : null,
    }),
    ...(input.staffSigned !== undefined && {
      staffSigned: input.staffSigned ? 1 : 0,
      staffSignedAt: input.staffSigned ? now : null,
    }),
  };

  if (existing) {
    await db
      .update(familyPartnershipAgreements)
      .set(values)
      .where(eq(familyPartnershipAgreements.id, existing.id));
    const [updated] = await db
      .select()
      .from(familyPartnershipAgreements)
      .where(eq(familyPartnershipAgreements.id, existing.id));
    return updated;
  }

  const [result] = await db.insert(familyPartnershipAgreements).values({
    familyId: input.familyId,
    organizationId: input.organizationId,
    status: input.status ?? "draft",
    strengths: input.strengths ?? [],
    needsAssessment: input.needsAssessment ?? null,
    targetVisits: input.targetVisits ?? 2,
    reviewDate: input.reviewDate ?? null,
    parentSigned: input.parentSigned ? 1 : 0,
    parentSignedAt: input.parentSigned ? now : null,
    staffSigned: input.staffSigned ? 1 : 0,
    staffSignedAt: input.staffSigned ? now : null,
    createdBy: input.createdBy ?? null,
  });

  const [created] = await db
    .select()
    .from(familyPartnershipAgreements)
    .where(eq(familyPartnershipAgreements.id, result.insertId));
  return created;
}

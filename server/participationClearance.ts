import { and, eq, inArray } from "drizzle-orm";
import { children, healthRecords, familyContactAddresses, digitalDocuments } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * "Cleared to attend" status — the generic (non-state-specific) child-care
 * licensing + Head Start Performance Standards (45 CFR 1302.42) blockers
 * that would actually prevent a child from participating, distinct from the
 * many informational compliance items already tracked elsewhere in the app
 * (see server/healthDeadlines.ts, server/auditReadiness.ts) which surface as
 * dashboards/reminders but never gate anything.
 *
 * Blockers checked (deliberately narrow — see the OEC audit this was built
 * from):
 *   1. Immunization record on file, not overdue, and if exempt the exemption
 *      names a type and (for medical exemptions) hasn't expired.
 *   2. At least one emergency-medical-treatment authorization on file for
 *      the child — either a family contact flagged authorizedEmergencyMedical,
 *      or a signed emergency_medical_consent digital document scoped to
 *      this child (or family-wide, if no child-specific one exists).
 *   3. At least one contact on file at all (can't reach anyone in an
 *      emergency) — the baseline "no emergency contact info exists"
 *      case, distinct from #2's stricter "consent to treat" case.
 *
 * This intentionally does NOT include the 45/90-day Head Start screening/
 * dental deadlines (healthDeadlines.ts) — those are ongoing compliance
 * deadlines, not day-one attendance gates, and re-surfacing them here as a
 * hard "blocked" state would conflate two different kinds of requirement.
 */

export type ClearanceBlockerCode =
  | "immunization_missing"
  | "immunization_overdue"
  | "immunization_exemption_undocumented"
  | "immunization_exemption_expired"
  | "no_emergency_contact"
  | "no_emergency_medical_consent";

export interface ClearanceBlocker {
  code: ClearanceBlockerCode;
  label: string;
}

export interface ChildClearanceStatus {
  childId: number;
  cleared: boolean;
  blockers: ClearanceBlocker[];
}

const BLOCKER_LABELS: Record<ClearanceBlockerCode, string> = {
  immunization_missing: "No immunization record on file",
  immunization_overdue: "Immunization record overdue",
  immunization_exemption_undocumented: "Immunization exemption is missing a type/documentation",
  immunization_exemption_expired: "Immunization exemption has expired",
  no_emergency_contact: "No emergency contact on file",
  no_emergency_medical_consent: "No emergency medical treatment authorization on file",
};

function blocker(code: ClearanceBlockerCode): ClearanceBlocker {
  return { code, label: BLOCKER_LABELS[code] };
}

/**
 * Computes clearance for a batch of children in one pass (few queries total,
 * not N+1) so this is cheap to call from a roster/kiosk screen showing many
 * children at once.
 */
export async function computeClearanceForChildren(
  childIds: number[],
  organizationId: number
): Promise<Map<number, ChildClearanceStatus>> {
  const result = new Map<number, ChildClearanceStatus>();
  if (childIds.length === 0) return result;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const kids = await db
    .select({ id: children.id, familyId: children.familyId })
    .from(children)
    .where(and(eq(children.organizationId, organizationId), inArray(children.id, childIds)));

  const familyIdByChild = new Map<number, number | null>();
  const familyIds = new Set<number>();
  for (const k of kids) {
    familyIdByChild.set(k.id, k.familyId ?? null);
    if (k.familyId != null) familyIds.add(k.familyId);
  }

  const immunizations = await db
    .select({
      childId: healthRecords.childId,
      status: healthRecords.status,
      exemptionType: healthRecords.exemptionType,
      exemptionExpiresAt: healthRecords.exemptionExpiresAt,
      recordDate: healthRecords.recordDate,
    })
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.organizationId, organizationId),
        eq(healthRecords.type, "immunization"),
        inArray(healthRecords.childId, childIds)
      )
    );

  // Most recent immunization record per child wins.
  const latestImmunization = new Map<number, (typeof immunizations)[number]>();
  for (const r of immunizations) {
    const existing = latestImmunization.get(r.childId);
    if (!existing || r.recordDate > existing.recordDate) latestImmunization.set(r.childId, r);
  }

  const contacts = familyIds.size
    ? await db
        .select({
          familyId: familyContactAddresses.familyId,
          authorizedEmergencyMedical: familyContactAddresses.authorizedEmergencyMedical,
        })
        .from(familyContactAddresses)
        .where(inArray(familyContactAddresses.familyId, Array.from(familyIds)))
    : [];

  const contactCountByFamily = new Map<number, number>();
  const emergencyMedicalByFamily = new Set<number>();
  for (const c of contacts) {
    contactCountByFamily.set(c.familyId, (contactCountByFamily.get(c.familyId) ?? 0) + 1);
    if (c.authorizedEmergencyMedical) emergencyMedicalByFamily.add(c.familyId);
  }

  const consents = await db
    .select({
      childId: digitalDocuments.childId,
      familyId: digitalDocuments.familyId,
      status: digitalDocuments.status,
    })
    .from(digitalDocuments)
    .where(
      and(
        eq(digitalDocuments.organizationId, organizationId),
        eq(digitalDocuments.documentType, "emergency_medical_consent"),
        eq(digitalDocuments.status, "signed")
      )
    );

  const signedConsentChildIds = new Set<number>();
  const signedConsentFamilyIds = new Set<number>();
  for (const c of consents) {
    if (c.childId != null) signedConsentChildIds.add(c.childId);
    else signedConsentFamilyIds.add(c.familyId);
  }

  for (const childId of childIds) {
    const blockers: ClearanceBlocker[] = [];
    const familyId = familyIdByChild.get(childId) ?? null;

    const imm = latestImmunization.get(childId);
    if (!imm) {
      blockers.push(blocker("immunization_missing"));
    } else if (imm.status === "overdue") {
      blockers.push(blocker("immunization_overdue"));
    } else if (imm.status === "exempt") {
      if (!imm.exemptionType) {
        blockers.push(blocker("immunization_exemption_undocumented"));
      } else if (
        imm.exemptionType === "medical" &&
        imm.exemptionExpiresAt &&
        imm.exemptionExpiresAt.getTime() < Date.now()
      ) {
        blockers.push(blocker("immunization_exemption_expired"));
      }
    }

    const contactCount = familyId != null ? contactCountByFamily.get(familyId) ?? 0 : 0;
    if (contactCount === 0) {
      blockers.push(blocker("no_emergency_contact"));
    } else {
      const hasConsent =
        signedConsentChildIds.has(childId) ||
        (familyId != null && (emergencyMedicalByFamily.has(familyId) || signedConsentFamilyIds.has(familyId)));
      if (!hasConsent) blockers.push(blocker("no_emergency_medical_consent"));
    }

    result.set(childId, { childId, cleared: blockers.length === 0, blockers });
  }

  return result;
}

export async function computeClearanceForChild(
  childId: number,
  organizationId: number
): Promise<ChildClearanceStatus> {
  const map = await computeClearanceForChildren([childId], organizationId);
  return map.get(childId) ?? { childId, cleared: true, blockers: [] };
}

/** All active children in an org, for roster-wide badge rendering. */
export async function computeClearanceForOrg(organizationId: number): Promise<Map<number, ChildClearanceStatus>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const active = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.organizationId, organizationId), eq(children.status, "active")));
  return computeClearanceForChildren(
    active.map((c) => c.id),
    organizationId
  );
}

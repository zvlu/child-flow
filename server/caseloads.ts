/**
 * Family Advocate case-load management.
 *
 * Families carry a `familyAdvocateId`; supervisors (admins) assign and
 * rebalance case loads, advocates get a focused "my families" queue. Stats
 * are computed live from the same records staff already keep (home visits,
 * goals, service follow-ups) — no extra data entry, same philosophy as the
 * Audit Readiness Score.
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  families, staff, familyHomeVisits, familyGoals, familyServices, children,
} from "../drizzle/schema";
import { getDb } from "./db";

/** Head Start guidance commonly caps advocate case loads around this size. */
export const CASELOAD_LIMIT = 40;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export type AdvocateOverview = {
  staffId: number;
  name: string;
  position: string | null;
  familyCount: number;
  overCapacity: boolean;
  /** Families with ANY logged contact this month (visit, call, coordinated services…). */
  contactedThisMonth: number;
  /** 0–100: share of the case load contacted this month. */
  contactCoverage: number;
  openGoals: number;
  followUpsDue: number;
  /** 0–100 blended accountability score (see computeHealthScore). */
  healthScore: number;
};

export type CaseloadOverview = {
  advocates: AdvocateOverview[];
  unassigned: { id: number; name: string; city: string | null; childCount: number }[];
  totalFamilies: number;
  caseloadLimit: number;
};

/**
 * Blended accountability score: monthly CONTACT coverage (any documented
 * contact — home visit, monthly contact, coordinated services, call) carries
 * most of the weight, open follow-ups drag it down, over-capacity caps it.
 * Pure so it's unit-testable.
 */
export function computeHealthScore(input: {
  familyCount: number;
  contactedThisMonth: number;
  followUpsDue: number;
  overCapacity: boolean;
}): number {
  if (input.familyCount === 0) return 100;
  const coverage = Math.min(1, input.contactedThisMonth / input.familyCount);
  const followUpDrag = Math.min(1, input.followUpsDue / input.familyCount);
  let score = coverage * 65 + (1 - followUpDrag) * 35;
  if (input.overCapacity) score = Math.min(score, 70);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export async function getCaseloadOverview(organizationId: number): Promise<CaseloadOverview> {
  const db = await requireDb();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);

  const [orgStaff, orgFamilies, visits, monthContacts, goals, services, orgChildren] = await Promise.all([
    db.select().from(staff).where(eq(staff.organizationId, organizationId)),
    db.select().from(families).where(eq(families.organizationId, organizationId)),
    db.select({ familyId: familyHomeVisits.familyId })
      .from(familyHomeVisits)
      .where(and(eq(familyHomeVisits.organizationId, organizationId), gte(familyHomeVisits.visitDate, monthStart))),
    // "Monthly contact" the way advocates actually document it: ANY logged
    // contact this month (monthly contact, coordinated services, calls,
    // office visits…), not just formal home visits.
    db.select({ familyId: familyServices.familyId })
      .from(familyServices)
      .where(and(eq(familyServices.organizationId, organizationId), gte(familyServices.serviceDate, monthStart))),
    db.select({ familyId: familyGoals.familyId, status: familyGoals.status })
      .from(familyGoals)
      .where(eq(familyGoals.organizationId, organizationId)),
    db.select({ familyId: familyServices.familyId, followUpRequired: familyServices.followUpRequired, followUpDate: familyServices.followUpDate })
      .from(familyServices)
      .where(eq(familyServices.organizationId, organizationId)),
    db.select({ familyId: children.familyId }).from(children).where(eq(children.organizationId, organizationId)),
  ]);

  const contactedFamilies = new Set([...visits.map((v) => v.familyId), ...monthContacts.map((c) => c.familyId)]);
  const openGoalsByFamily = new Map<number, number>();
  for (const g of goals) {
    if (g.status === "completed") continue;
    openGoalsByFamily.set(g.familyId, (openGoalsByFamily.get(g.familyId) ?? 0) + 1);
  }
  const followUpDueFamilies = new Set(
    services
      .filter((s) => s.followUpRequired === 1 && s.followUpDate != null && new Date(s.followUpDate) <= soon)
      .map((s) => s.familyId)
  );
  const childCountByFamily = new Map<number, number>();
  for (const c of orgChildren) {
    if (c.familyId == null) continue;
    childCountByFamily.set(c.familyId, (childCountByFamily.get(c.familyId) ?? 0) + 1);
  }

  const familiesByAdvocate = new Map<number, typeof orgFamilies>();
  const unassigned: CaseloadOverview["unassigned"] = [];
  for (const f of orgFamilies) {
    if (f.familyAdvocateId == null) {
      unassigned.push({ id: f.id, name: f.primaryContactName, city: f.city, childCount: childCountByFamily.get(f.id) ?? 0 });
    } else {
      const list = familiesByAdvocate.get(f.familyAdvocateId) ?? [];
      list.push(f);
      familiesByAdvocate.set(f.familyAdvocateId, list);
    }
  }

  const advocates: AdvocateOverview[] = orgStaff
    .map((s) => {
      const assigned = familiesByAdvocate.get(s.id) ?? [];
      const familyCount = assigned.length;
      const contactedThisMonth = assigned.filter((f) => contactedFamilies.has(f.id)).length;
      const followUpsDue = assigned.filter((f) => followUpDueFamilies.has(f.id)).length;
      const openGoals = assigned.reduce((n, f) => n + (openGoalsByFamily.get(f.id) ?? 0), 0);
      const overCapacity = familyCount > CASELOAD_LIMIT;
      return {
        staffId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        position: s.position,
        familyCount,
        overCapacity,
        contactedThisMonth,
        contactCoverage: familyCount === 0 ? 100 : Math.round((contactedThisMonth / familyCount) * 100),
        openGoals,
        followUpsDue,
        healthScore: computeHealthScore({ familyCount, contactedThisMonth, followUpsDue, overCapacity }),
      };
    })
    // Card wall shows people who carry (or could carry) case loads — everyone,
    // sorted with loaded advocates first so the wall reads at a glance.
    .sort((a, b) => b.familyCount - a.familyCount || a.name.localeCompare(b.name));

  return { advocates, unassigned, totalFamilies: orgFamilies.length, caseloadLimit: CASELOAD_LIMIT };
}

/** Supervisor action: point a set of families at an advocate (null = unassign). */
export async function assignAdvocate(
  organizationId: number,
  familyIds: number[],
  advocateId: number | null
): Promise<{ updated: number; overCapacityWarning: string | null }> {
  const db = await requireDb();
  if (advocateId != null) {
    const [advocate] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, advocateId), eq(staff.organizationId, organizationId)))
      .limit(1);
    if (!advocate) throw new Error("That staff member isn't part of this organization.");
  }
  if (familyIds.length === 0) return { updated: 0, overCapacityWarning: null };

  // suggestAssignments respects CASELOAD_LIMIT, but a supervisor assigning by
  // hand had no signal at all if the move pushed someone over it — this
  // doesn't block the assignment (a supervisor may have a good reason, e.g.
  // temporary coverage), it just surfaces what the overview page already
  // flags as "overCapacity" so it isn't silently discovered later.
  let overCapacityWarning: string | null = null;
  if (advocateId != null) {
    const [[{ count: currentLoad } = { count: 0 }], toAssign] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(families)
        .where(and(eq(families.organizationId, organizationId), eq(families.familyAdvocateId, advocateId))),
      db
        .select({ id: families.id, familyAdvocateId: families.familyAdvocateId })
        .from(families)
        .where(and(eq(families.organizationId, organizationId), inArray(families.id, familyIds))),
    ]);
    const newlyAdded = toAssign.filter((f) => f.familyAdvocateId !== advocateId).length;
    const projectedLoad = Number(currentLoad) + newlyAdded;
    if (projectedLoad > CASELOAD_LIMIT) {
      overCapacityWarning = `This assignment brings this advocate to ${projectedLoad} families, above the ${CASELOAD_LIMIT}-family case-load limit.`;
    }
  }

  await db
    .update(families)
    .set({ familyAdvocateId: advocateId })
    .where(and(eq(families.organizationId, organizationId), inArray(families.id, familyIds)));
  return { updated: familyIds.length, overCapacityWarning };
}

export type MyCaseloadFamily = {
  id: number;
  name: string;
  phone: string | null;
  city: string | null;
  childCount: number;
  lastVisit: string | null;
  nextFollowUp: string | null;
  openGoals: number;
  /** 2 = overdue follow-up, 1 = due soon / no recent visit, 0 = steady. */
  urgency: 0 | 1 | 2;
  urgencyReason: string | null;
};

/** The advocate's focused queue, most urgent first. Deterministic on purpose. */
export async function getMyCaseload(organizationId: number, staffId: number): Promise<MyCaseloadFamily[]> {
  const db = await requireDb();
  const mine = await db
    .select()
    .from(families)
    .where(and(eq(families.organizationId, organizationId), eq(families.familyAdvocateId, staffId)));
  if (mine.length === 0) return [];
  const ids = mine.map((f) => f.id);

  const [visits, goals, services, kids] = await Promise.all([
    db.select({ familyId: familyHomeVisits.familyId, visitDate: familyHomeVisits.visitDate })
      .from(familyHomeVisits)
      .where(and(eq(familyHomeVisits.organizationId, organizationId), inArray(familyHomeVisits.familyId, ids))),
    db.select({ familyId: familyGoals.familyId, status: familyGoals.status })
      .from(familyGoals)
      .where(inArray(familyGoals.familyId, ids)),
    db.select({ familyId: familyServices.familyId, followUpRequired: familyServices.followUpRequired, followUpDate: familyServices.followUpDate })
      .from(familyServices)
      .where(inArray(familyServices.familyId, ids)),
    db.select({ familyId: children.familyId }).from(children).where(inArray(children.familyId, ids)),
  ]);

  const lastVisitByFamily = new Map<number, Date>();
  for (const v of visits) {
    const cur = lastVisitByFamily.get(v.familyId);
    if (!cur || v.visitDate > cur) lastVisitByFamily.set(v.familyId, v.visitDate);
  }
  const nextFollowUpByFamily = new Map<number, Date>();
  for (const svc of services) {
    if (svc.followUpRequired !== 1 || svc.followUpDate == null) continue;
    const cur = nextFollowUpByFamily.get(svc.familyId);
    if (!cur || svc.followUpDate < cur) nextFollowUpByFamily.set(svc.familyId, svc.followUpDate);
  }
  const openGoalsByFamily = new Map<number, number>();
  for (const g of goals) {
    if (g.status === "completed") continue;
    openGoalsByFamily.set(g.familyId, (openGoalsByFamily.get(g.familyId) ?? 0) + 1);
  }
  const childCountByFamily = new Map<number, number>();
  for (const c of kids) {
    if (c.familyId == null) continue;
    childCountByFamily.set(c.familyId, (childCountByFamily.get(c.familyId) ?? 0) + 1);
  }

  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  const staleVisit = new Date();
  staleVisit.setDate(staleVisit.getDate() - 30);

  return mine
    .map((f) => {
      const lastVisit = lastVisitByFamily.get(f.id) ?? null;
      const nextFollowUp = nextFollowUpByFamily.get(f.id) ?? null;
      let urgency: 0 | 1 | 2 = 0;
      let urgencyReason: string | null = null;
      if (nextFollowUp && nextFollowUp < now) {
        urgency = 2;
        urgencyReason = `Follow-up overdue since ${nextFollowUp.toLocaleDateString()}`;
      } else if (nextFollowUp && nextFollowUp <= soon) {
        urgency = 1;
        urgencyReason = `Follow-up due ${nextFollowUp.toLocaleDateString()}`;
      } else if (!lastVisit || lastVisit < staleVisit) {
        urgency = 1;
        urgencyReason = lastVisit ? "No home visit in 30+ days" : "No home visit on record";
      }
      return {
        id: f.id,
        name: f.primaryContactName,
        phone: f.primaryContactPhone,
        city: f.city,
        childCount: childCountByFamily.get(f.id) ?? 0,
        lastVisit: lastVisit ? lastVisit.toISOString() : null,
        nextFollowUp: nextFollowUp ? nextFollowUp.toISOString() : null,
        openGoals: openGoalsByFamily.get(f.id) ?? 0,
        urgency,
        urgencyReason,
      };
    })
    .sort((a, b) => b.urgency - a.urgency || a.name.localeCompare(b.name));
}

export type AssignmentSuggestion = {
  familyId: number;
  familyName: string;
  advocateId: number;
  advocateName: string;
  reason: string;
};

/**
 * Balanced-assignment suggestions for unassigned families: lowest current
 * load wins, with a same-city tiebreak when the advocate already serves that
 * city (a pragmatic stand-in for geographic routing). Deterministic — the
 * supervisor reviews and applies, nothing moves on its own.
 */
export async function suggestAssignments(organizationId: number): Promise<AssignmentSuggestion[]> {
  const db = await requireDb();
  const [orgStaff, orgFamilies] = await Promise.all([
    db.select().from(staff).where(eq(staff.organizationId, organizationId)),
    db.select().from(families).where(eq(families.organizationId, organizationId)),
  ]);
  if (orgStaff.length === 0) return [];

  const load = new Map<number, number>();
  const cities = new Map<number, Set<string>>();
  for (const s of orgStaff) {
    load.set(s.id, 0);
    cities.set(s.id, new Set());
  }
  for (const f of orgFamilies) {
    if (f.familyAdvocateId == null) continue;
    load.set(f.familyAdvocateId, (load.get(f.familyAdvocateId) ?? 0) + 1);
    if (f.city) cities.get(f.familyAdvocateId)?.add(f.city.toLowerCase());
  }

  const suggestions: AssignmentSuggestion[] = [];
  const unassigned = orgFamilies.filter((f) => f.familyAdvocateId == null);
  for (const f of unassigned) {
    const city = f.city?.toLowerCase();
    const ranked = [...orgStaff].sort((a, b) => {
      const cityA = city && cities.get(a.id)?.has(city) ? 1 : 0;
      const cityB = city && cities.get(b.id)?.has(city) ? 1 : 0;
      // Prefer same-city advocates, then the lightest load.
      return cityB - cityA || (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0);
    });
    const pick = ranked[0];
    if (!pick || (load.get(pick.id) ?? 0) >= CASELOAD_LIMIT) continue; // nobody has room
    const sameCity = city && cities.get(pick.id)?.has(city);
    suggestions.push({
      familyId: f.id,
      familyName: f.primaryContactName,
      advocateId: pick.id,
      advocateName: `${pick.firstName} ${pick.lastName}`,
      reason: sameCity
        ? `Lightest load already serving ${f.city} (${load.get(pick.id)} families)`
        : `Lightest current load (${load.get(pick.id)} families)`,
    });
    load.set(pick.id, (load.get(pick.id) ?? 0) + 1);
    if (city) cities.get(pick.id)?.add(city);
  }
  return suggestions;
}

/** LLM weekly supervisor digest over the overview numbers (no PHI beyond names/counts). */
export async function generateSupervisorSummary(organizationId: number): Promise<{
  summary: string;
  doingWell: string[];
  needsSupport: string[];
  generatedAt: string;
} | null> {
  const overview = await getCaseloadOverview(organizationId);
  const active = overview.advocates.filter((a) => a.familyCount > 0);
  if (active.length === 0) return null;

  const lines = active
    .map(
      (a) =>
        `- ${a.name} (${a.position ?? "staff"}): ${a.familyCount} families, ${a.contactCoverage}% contacted this month, ` +
        `${a.followUpsDue} follow-ups due, ${a.openGoals} open goals, health score ${a.healthScore}${a.overCapacity ? " — OVER CAPACITY" : ""}`
    )
    .join("\n");

  const { invokeLLM } = await import("./_core/llm");
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a Head Start family-services supervisor's assistant. Given per-advocate case-load metrics, write a brief, " +
          "supportive weekly summary. Be specific and name advocates. Frame struggling advocates as needing support, never blame. " +
          `Case-load limit is ${CASELOAD_LIMIT} families. ${overview.unassigned.length} families are currently unassigned.`,
      },
      { role: "user", content: `ADVOCATE METRICS THIS MONTH:\n${lines}` },
    ],
    outputSchema: {
      name: "supervisor_summary",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "3-4 sentence overview of the week" },
          doingWell: { type: "array", items: { type: "string" }, description: "1-3 specific positives, naming advocates" },
          needsSupport: { type: "array", items: { type: "string" }, description: "1-3 specific support needs, naming advocates" },
        },
        required: ["summary", "doingWell", "needsSupport"],
        additionalProperties: false,
      },
      strict: true,
    },
  });

  const raw = result.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p) => ("text" in p ? p.text : "")).join("") : "";
  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary,
      doingWell: Array.isArray(parsed.doingWell) ? parsed.doingWell : [],
      needsSupport: Array.isArray(parsed.needsSupport) ? parsed.needsSupport : [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return text.trim()
      ? { summary: text.trim(), doingWell: [], needsSupport: [], generatedAt: new Date().toISOString() }
      : null;
  }
}

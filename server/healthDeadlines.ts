import { and, eq, inArray } from "drizzle-orm";
import { children, healthRecords } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Head Start health compliance deadlines (45 CFR §1302.42):
 *
 *   45 days from entry — determine health status: well-child care current,
 *     plus vision and hearing screening ("screening").
 *   90 days from entry — determine dental status ("dental").
 *
 * A child satisfies the 45-day item when they have any physical, vision, or
 * hearing record; the 90-day item when they have a dental record. Deadlines
 * count from `children.enrollmentDate`.
 */

export type DeadlineState = "complete" | "due_soon" | "overdue" | "pending";

export interface ChildDeadline {
  childId: number;
  childName: string;
  enrollmentDate: string; // ISO
  screening: { state: DeadlineState; deadline: string; daysLeft: number };
  dental: { state: DeadlineState; deadline: string; daysLeft: number };
}

export interface HealthDeadlineSummary {
  childrenTracked: number;
  screeningComplete: number;
  dentalComplete: number;
  overdueCount: number;
  dueSoonCount: number;
  items: ChildDeadline[];
}

const SCREENING_TYPES = ["physical", "vision", "hearing"] as const;
const DUE_SOON_DAYS = 14;

function evalDeadline(
  satisfied: boolean,
  enrollment: Date,
  windowDays: number
): { state: DeadlineState; deadline: string; daysLeft: number } {
  const deadline = new Date(enrollment);
  deadline.setDate(deadline.getDate() + windowDays);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (24 * 3600 * 1000));
  let state: DeadlineState;
  if (satisfied) state = "complete";
  else if (daysLeft < 0) state = "overdue";
  else if (daysLeft <= DUE_SOON_DAYS) state = "due_soon";
  else state = "pending";
  return { state, deadline: deadline.toISOString(), daysLeft };
}

export async function getHealthDeadlineSummary(
  organizationId: number
): Promise<HealthDeadlineSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const kids = await db
    .select({
      id: children.id,
      firstName: children.firstName,
      lastName: children.lastName,
      enrollmentDate: children.enrollmentDate,
    })
    .from(children)
    .where(and(eq(children.organizationId, organizationId), eq(children.status, "active")));

  const records = await db
    .select({ childId: healthRecords.childId, type: healthRecords.type })
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.organizationId, organizationId),
        inArray(healthRecords.type, [...SCREENING_TYPES, "dental"])
      )
    );

  const hasScreening = new Set<number>();
  const hasDental = new Set<number>();
  for (const r of records) {
    if (r.type === "dental") hasDental.add(r.childId);
    else hasScreening.add(r.childId);
  }

  const items: ChildDeadline[] = [];
  let screeningComplete = 0;
  let dentalComplete = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const kid of kids) {
    const enrollment = kid.enrollmentDate ?? new Date();
    const screening = evalDeadline(hasScreening.has(kid.id), enrollment, 45);
    const dental = evalDeadline(hasDental.has(kid.id), enrollment, 90);

    if (screening.state === "complete") screeningComplete += 1;
    if (dental.state === "complete") dentalComplete += 1;
    for (const s of [screening.state, dental.state]) {
      if (s === "overdue") overdueCount += 1;
      if (s === "due_soon") dueSoonCount += 1;
    }

    items.push({
      childId: kid.id,
      childName: `${kid.firstName} ${kid.lastName}`,
      enrollmentDate: enrollment.toISOString(),
      screening,
      dental,
    });
  }

  // Most urgent first: overdue, then due soon, then pending, complete last.
  const order: Record<DeadlineState, number> = {
    overdue: 0,
    due_soon: 1,
    pending: 2,
    complete: 3,
  };
  const urgency = (c: ChildDeadline) =>
    Math.min(order[c.screening.state], order[c.dental.state]) * 1000 +
    Math.min(c.screening.daysLeft, c.dental.daysLeft);
  items.sort((a, b) => urgency(a) - urgency(b));

  return {
    childrenTracked: kids.length,
    screeningComplete,
    dentalComplete,
    overdueCount,
    dueSoonCount,
    items,
  };
}

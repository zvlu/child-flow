import { and, desc, eq } from "drizzle-orm";
import {
  children,
  suspensionExpulsionLogs,
  type SuspensionExpulsionLog,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * §1302.17 suspension/expulsion documentation.
 * Every incident must show the interventions attempted before exclusion.
 */

export const REQUIRED_STEPS = [
  "mental_health_consult",
  "parent_meeting",
  "individualized_supports",
  "community_referrals",
  "home_visit",
] as const;

export interface IncidentWithChild extends SuspensionExpulsionLog {
  childName: string;
}

export async function listIncidents(organizationId: number): Promise<IncidentWithChild[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      log: suspensionExpulsionLogs,
      firstName: children.firstName,
      lastName: children.lastName,
    })
    .from(suspensionExpulsionLogs)
    .innerJoin(
      children,
      and(eq(suspensionExpulsionLogs.childId, children.id), eq(children.organizationId, organizationId))
    )
    .where(eq(suspensionExpulsionLogs.organizationId, organizationId))
    .orderBy(desc(suspensionExpulsionLogs.incidentDate));
  return rows.map((r) => ({ ...r.log, childName: `${r.firstName} ${r.lastName}` }));
}

export async function createIncident(input: {
  organizationId: number;
  childId: number;
  incidentDate: Date;
  type: SuspensionExpulsionLog["type"];
  description: string;
  stepsTaken?: string[];
  outcome?: string | null;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Tenancy: the child must belong to the caller's organization.
  const [child] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, input.childId), eq(children.organizationId, input.organizationId)))
    .limit(1);
  if (!child) throw new Error("Child not found in this organization");
  const [result] = await db.insert(suspensionExpulsionLogs).values({
    organizationId: input.organizationId,
    childId: input.childId,
    incidentDate: input.incidentDate,
    type: input.type,
    description: input.description,
    stepsTaken: input.stepsTaken ?? [],
    outcome: input.outcome ?? null,
  });
  return { id: result.insertId };
}

export async function updateIncident(input: {
  id: number;
  organizationId: number;
  stepsTaken?: string[];
  outcome?: string | null;
  status?: "open" | "resolved";
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(suspensionExpulsionLogs)
    .set({
      ...(input.stepsTaken !== undefined && { stepsTaken: input.stepsTaken }),
      ...(input.outcome !== undefined && { outcome: input.outcome }),
      ...(input.status !== undefined && {
        status: input.status,
        resolvedAt: input.status === "resolved" ? new Date() : null,
      }),
    })
    .where(
      and(
        eq(suspensionExpulsionLogs.id, input.id),
        eq(suspensionExpulsionLogs.organizationId, input.organizationId)
      )
    );
}

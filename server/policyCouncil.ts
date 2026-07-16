import { and, desc, eq } from "drizzle-orm";
import {
  families,
  policyCouncilMeetings,
  policyCouncilMembers,
  type PolicyCouncilMeeting,
  type PolicyCouncilMember,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Policy Council management (§1302.50–51): membership roster with the
 * parent-majority requirement surfaced, plus meeting minutes and action items.
 */

export async function listMembers(organizationId: number): Promise<PolicyCouncilMember[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(policyCouncilMembers)
    .where(eq(policyCouncilMembers.organizationId, organizationId))
    // Enum order is ('active','ended') — ascending puts active members first.
    .orderBy(policyCouncilMembers.status, policyCouncilMembers.councilRole);
}

export async function addMember(input: {
  organizationId: number;
  name: string;
  memberType: "parent" | "community_rep";
  councilRole?: PolicyCouncilMember["councilRole"];
  familyId?: number | null;
  termStart?: Date | null;
  termEnd?: Date | null;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Tenancy: a linked family must belong to the caller's organization.
  if (input.familyId != null) {
    const [family] = await db
      .select({ id: families.id })
      .from(families)
      .where(and(eq(families.id, input.familyId), eq(families.organizationId, input.organizationId)))
      .limit(1);
    if (!family) throw new Error("Family not found in this organization");
  }
  const [result] = await db.insert(policyCouncilMembers).values({
    organizationId: input.organizationId,
    name: input.name,
    memberType: input.memberType,
    councilRole: input.councilRole ?? "member",
    familyId: input.familyId ?? null,
    termStart: input.termStart ?? null,
    termEnd: input.termEnd ?? null,
  });
  return { id: result.insertId };
}

export async function updateMember(input: {
  id: number;
  organizationId: number;
  councilRole?: PolicyCouncilMember["councilRole"];
  status?: "active" | "ended";
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(policyCouncilMembers)
    .set({
      ...(input.councilRole !== undefined && { councilRole: input.councilRole }),
      ...(input.status !== undefined && {
        status: input.status,
        ...(input.status === "ended" && { termEnd: new Date() }),
      }),
    })
    .where(
      and(
        eq(policyCouncilMembers.id, input.id),
        eq(policyCouncilMembers.organizationId, input.organizationId)
      )
    );
}

export async function listMeetings(organizationId: number): Promise<PolicyCouncilMeeting[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(policyCouncilMeetings)
    .where(eq(policyCouncilMeetings.organizationId, organizationId))
    .orderBy(desc(policyCouncilMeetings.meetingDate));
}

export async function addMeeting(input: {
  organizationId: number;
  meetingDate: Date;
  title: string;
  minutes?: string | null;
  attendeeCount?: number;
  quorumMet?: boolean;
  actionItems?: string[];
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(policyCouncilMeetings).values({
    organizationId: input.organizationId,
    meetingDate: input.meetingDate,
    title: input.title,
    minutes: input.minutes ?? null,
    attendeeCount: input.attendeeCount ?? 0,
    quorumMet: input.quorumMet ? 1 : 0,
    actionItems: input.actionItems ?? [],
  });
  return { id: result.insertId };
}

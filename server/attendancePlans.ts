import { and, desc, eq } from "drizzle-orm";
import { attendancePlans, children, staff, type InsertAttendancePlan } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Attendance Improvement Plans (AIP) — §1302.16 requires programs to work
 * with families of chronically absent children on a documented plan. Web
 * counterpart of the iOS Attendance Plans / Chronic Absence "Create Plan"
 * flow; see server/chronicAbsence.ts for the read-only risk analysis this
 * complements.
 */

export async function getAttendancePlans(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      plan: attendancePlans,
      childFirst: children.firstName,
      childLast: children.lastName,
      advocateFirst: staff.firstName,
      advocateLast: staff.lastName,
    })
    .from(attendancePlans)
    .innerJoin(children, eq(attendancePlans.childId, children.id))
    .leftJoin(staff, eq(attendancePlans.familyAdvocate, staff.id))
    .where(eq(attendancePlans.organizationId, organizationId))
    .orderBy(desc(attendancePlans.createdDate));
  return rows.map((r) => ({
    ...r.plan,
    childName: `${r.childFirst} ${r.childLast}`,
    familyAdvocateName: r.advocateFirst != null ? `${r.advocateFirst} ${r.advocateLast}` : "Unassigned",
  }));
}

export async function createAttendancePlan(input: InsertAttendancePlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(attendancePlans).values(input);
  return { id: result.insertId };
}

export async function updateAttendancePlan(
  id: number,
  organizationId: number,
  patch: Partial<Pick<InsertAttendancePlan, "reviewDate" | "barriers" | "strategies" | "status" | "notes">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(attendancePlans).set(patch).where(and(eq(attendancePlans.id, id), eq(attendancePlans.organizationId, organizationId)));
  return { success: true };
}

import { and, desc, eq } from "drizzle-orm";
import {
  classroomAssessments,
  classrooms,
  type ClassroomAssessment,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * CLASS / ECERS classroom quality observations (roadmap #13).
 * Scores are stored per dimension; domain math lives on the client so the
 * instrument definitions stay in one place (the page).
 */

export interface AssessmentWithClassroom extends ClassroomAssessment {
  classroomName: string;
}

export async function listAssessments(organizationId: number): Promise<AssessmentWithClassroom[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ a: classroomAssessments, classroomName: classrooms.name })
    .from(classroomAssessments)
    .innerJoin(
      classrooms,
      and(eq(classroomAssessments.classroomId, classrooms.id), eq(classrooms.organizationId, organizationId))
    )
    .where(eq(classroomAssessments.organizationId, organizationId))
    .orderBy(desc(classroomAssessments.assessmentDate));
  return rows.map((r) => ({ ...r.a, classroomName: r.classroomName }));
}

export async function createAssessment(input: {
  organizationId: number;
  classroomId: number;
  tool: "class" | "ecers";
  assessmentDate: Date;
  observer?: string | null;
  scores: Record<string, number>;
  coachingNotes?: string | null;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Tenancy: the classroom must belong to the caller's organization.
  const [room] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(and(eq(classrooms.id, input.classroomId), eq(classrooms.organizationId, input.organizationId)))
    .limit(1);
  if (!room) throw new Error("Classroom not found in this organization");
  const [result] = await db.insert(classroomAssessments).values({
    organizationId: input.organizationId,
    classroomId: input.classroomId,
    tool: input.tool,
    assessmentDate: input.assessmentDate,
    observer: input.observer ?? null,
    scores: input.scores,
    coachingNotes: input.coachingNotes ?? null,
  });
  return { id: result.insertId };
}

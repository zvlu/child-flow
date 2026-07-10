import { and, desc, eq } from "drizzle-orm";
import {
  families, children, staff,
  familyGoals, familyReferrals, familyHomeVisits, familyNeedsAssessments,
  cfcrRecords, familyCaseNotes, familyServices,
  type InsertFamilyGoalRow, type InsertFamilyReferral, type InsertFamilyHomeVisit,
  type InsertFamilyNeedsAssessment, type InsertCfcrRecord, type InsertFamilyCaseNote,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Family case-management features (Head Start module): SMART goals, resource
 * referrals, home-visiting logs, Family Needs Assessment (FNA), Child &
 * Family Case Review (CFCR), and narrative case notes. These back both the
 * iOS Family Services screens and (via the same functions) future web UI —
 * see server/routers.ts for the tRPC surface and server/programModules.ts
 * for the iOS REST mirror.
 */

function staffName(row: { firstName: string; lastName: string } | null | undefined): string {
  return row ? `${row.firstName} ${row.lastName}` : "Unassigned";
}

// ==================== Family Goals ====================

export async function getFamilyGoals(familyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(familyGoals).where(eq(familyGoals.familyId, familyId)).orderBy(desc(familyGoals.createdAt));
}

export async function createFamilyGoal(input: {
  organizationId: number;
  familyId: number;
  title: string;
  description?: string | null;
  category?: string | null;
  targetDate?: Date | null;
  steps?: Array<{ id: string; title: string; isCompleted: boolean; dueDate: string | null; notes: string | null }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: InsertFamilyGoalRow = {
    organizationId: input.organizationId,
    familyId: input.familyId,
    title: input.title,
    description: input.description ?? null,
    category: input.category ?? null,
    targetDate: input.targetDate ?? null,
    status: "not_started",
    progress: 0,
    steps: input.steps ?? [],
  };
  const [result] = await db.insert(familyGoals).values(values);
  return { id: result.insertId };
}

/** Toggle one step's completion; recomputes progress (% of steps complete) and status. */
export async function updateGoalStep(goalId: number, stepId: string, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [goal] = await db.select().from(familyGoals).where(eq(familyGoals.id, goalId)).limit(1);
  if (!goal) throw new Error("Goal not found");
  const steps = (goal.steps ?? []).map((s) => (s.id === stepId ? { ...s, isCompleted: completed } : s));
  const doneCount = steps.filter((s) => s.isCompleted).length;
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : goal.progress;
  const allDone = steps.length > 0 && doneCount === steps.length;
  await db.update(familyGoals)
    .set({
      steps,
      progress,
      status: allDone ? "completed" : progress > 0 ? "in_progress" : goal.status,
      completedDate: allDone ? new Date() : goal.completedDate,
    })
    .where(eq(familyGoals.id, goalId));
  return { success: true };
}

// ==================== Family Referrals ====================

export async function getFamilyReferrals(familyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(familyReferrals).where(eq(familyReferrals.familyId, familyId)).orderBy(desc(familyReferrals.referralDate));
}

export async function createFamilyReferral(input: InsertFamilyReferral) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(familyReferrals).values(input);
  return { id: result.insertId };
}

export async function updateFamilyReferral(
  id: number,
  organizationId: number,
  patch: Partial<Pick<InsertFamilyReferral, "status" | "followUpDate" | "notes" | "outcomeNotes">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(familyReferrals).set(patch).where(and(eq(familyReferrals.id, id), eq(familyReferrals.organizationId, organizationId)));
  return { success: true };
}

// ==================== Home Visit Logs ====================

export async function getFamilyHomeVisits(familyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(familyHomeVisits).where(eq(familyHomeVisits.familyId, familyId)).orderBy(desc(familyHomeVisits.visitDate));
}

export async function createFamilyHomeVisit(input: InsertFamilyHomeVisit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(familyHomeVisits).values(input);
  return { id: result.insertId };
}

// ==================== Contacts (general log, shared with web) ====================

export async function getFamilyContacts(familyId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ svc: familyServices, staffFirst: staff.firstName, staffLast: staff.lastName })
    .from(familyServices)
    .leftJoin(staff, eq(familyServices.recordedBy, staff.id))
    .where(eq(familyServices.familyId, familyId))
    .orderBy(desc(familyServices.serviceDate));
  return rows.map((r) => ({ ...r.svc, contactedByName: staffName(r.staffFirst != null ? { firstName: r.staffFirst, lastName: r.staffLast! } : null) }));
}

// ==================== Family Needs Assessment (FNA) ====================

export async function getFamilyNeedsAssessment(familyId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(familyNeedsAssessments).where(eq(familyNeedsAssessments.familyId, familyId)).limit(1);
  return row ?? null;
}

/** Upsert the family's single current FNA (re-assessing overwrites ratings/notes). */
export async function saveFamilyNeedsAssessment(input: {
  organizationId: number;
  familyId: number;
  conductedBy: number | null;
  ratings: Array<{ id: string; domain: string; level: number; notes: string }>;
  notes: string;
  isComplete: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getFamilyNeedsAssessment(input.familyId);
  if (existing) {
    await db.update(familyNeedsAssessments)
      .set({
        conductedBy: input.conductedBy,
        conductedDate: new Date(),
        ratings: input.ratings,
        notes: input.notes,
        isComplete: input.isComplete ? 1 : 0,
      })
      .where(eq(familyNeedsAssessments.id, existing.id));
    return { id: existing.id };
  }
  const values: InsertFamilyNeedsAssessment = {
    organizationId: input.organizationId,
    familyId: input.familyId,
    conductedBy: input.conductedBy,
    ratings: input.ratings,
    notes: input.notes,
    isComplete: input.isComplete ? 1 : 0,
  };
  const [result] = await db.insert(familyNeedsAssessments).values(values);
  return { id: result.insertId };
}

// ==================== CFCR (Child & Family Case Review) ====================

export async function getCfcrRecords(childId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cfcrRecords).where(eq(cfcrRecords.childId, childId)).orderBy(desc(cfcrRecords.meetingDate));
}

export async function createCfcrRecord(input: InsertCfcrRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(cfcrRecords).values(input);
  return { id: result.insertId };
}

// ==================== Family Case Notes ====================

export async function getFamilyCaseNotes(familyId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ note: familyCaseNotes, firstName: staff.firstName, lastName: staff.lastName })
    .from(familyCaseNotes)
    .leftJoin(staff, eq(familyCaseNotes.authorId, staff.id))
    .where(eq(familyCaseNotes.familyId, familyId))
    .orderBy(desc(familyCaseNotes.createdAt));
  return rows.map((r) => ({ ...r.note, authorName: staffName(r.firstName != null ? { firstName: r.firstName, lastName: r.lastName! } : null) }));
}

export async function createFamilyCaseNote(input: InsertFamilyCaseNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(familyCaseNotes).values(input);
  return { id: result.insertId };
}

export async function setCaseNoteFollowUpCompleted(id: number, organizationId: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(familyCaseNotes).set({ followUpCompleted: completed ? 1 : 0 }).where(and(eq(familyCaseNotes.id, id), eq(familyCaseNotes.organizationId, organizationId)));
  const [row] = await db.select().from(familyCaseNotes).where(eq(familyCaseNotes.id, id)).limit(1);
  return row ?? null;
}

// ==================== Tenancy helpers ====================

/** Does this family belong to the org? Used before any family-scoped write. */
export async function familyBelongsToOrg(familyId: number, organizationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: families.id }).from(families).where(and(eq(families.id, familyId), eq(families.organizationId, organizationId))).limit(1);
  return !!row;
}

/** Does this child belong to the org? Used before any child-scoped write (CFCR). */
export async function childBelongsToOrg(childId: number, organizationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: children.id }).from(children).where(and(eq(children.id, childId), eq(children.organizationId, organizationId))).limit(1);
  return !!row;
}

// ==================== AI Case Summary ====================

export type CaseSummaryResult = {
  summary: string;
  themes: string[];
  goalSuggestions: {
    /** Matches an existing goal id when the model links to one; null = proposed new goal. */
    goalId: number | null;
    title: string;
    rationale: string;
  }[];
  noteCount: number;
  generatedAt: string;
};

/**
 * True LLM case-note summarization (replaces the template-based assistant):
 * digest a family's case-note history, surface recurring themes, and link the
 * work to existing family goals — or propose a new one when a theme has no
 * goal behind it. Sensitive notes are included (staff-only surface) but the
 * model is instructed to keep the summary professional and non-graphic.
 */
export async function summarizeFamilyCaseNotes(familyId: number): Promise<CaseSummaryResult | null> {
  const [notes, goals] = await Promise.all([getFamilyCaseNotes(familyId), getFamilyGoals(familyId)]);
  if (notes.length === 0) return null;

  // Newest 30 notes keeps the prompt bounded for long case histories.
  const recent = notes.slice(0, 30);
  const noteLines = recent
    .map((n) => {
      const date = new Date(n.createdAt).toISOString().slice(0, 10);
      const followUp = n.followUpRequired && !n.followUpCompleted ? " [follow-up open]" : "";
      return `- ${date} (${n.type}, by ${n.authorName})${followUp}: ${n.body}`;
    })
    .join("\n");
  const goalLines =
    goals.length === 0
      ? "None yet."
      : goals
          .map((g) => `- id=${g.id} "${g.title}" (${g.status}, ${g.progress}% complete)`)
          .join("\n");

  const { invokeLLM } = await import("./_core/llm");
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a Head Start family-services assistant. Summarize case notes for a staff member preparing " +
          "for their next family contact. Be concise, professional, and strengths-based. Never invent facts. " +
          "Link themes to the existing goals when they clearly relate (use the given goal id); when an important " +
          "theme has no matching goal, propose a new one with goalId null.",
      },
      {
        role: "user",
        content: `EXISTING FAMILY GOALS:\n${goalLines}\n\nCASE NOTES (newest first):\n${noteLines}`,
      },
    ],
    outputSchema: {
      name: "case_summary",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "3-5 sentence narrative summary of the case history" },
          themes: { type: "array", items: { type: "string" }, description: "2-5 short recurring themes" },
          goalSuggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                goalId: { type: ["integer", "null"] },
                title: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["goalId", "title", "rationale"],
              additionalProperties: false,
            },
          },
        },
        required: ["summary", "themes", "goalSuggestions"],
        additionalProperties: false,
      },
      strict: true,
    },
  });

  const raw = result.choices?.[0]?.message?.content;
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((part) => ("text" in part ? part.text : "")).join("")
        : "";
  try {
    const parsed = JSON.parse(text) as Omit<CaseSummaryResult, "noteCount" | "generatedAt">;
    return {
      summary: parsed.summary,
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      goalSuggestions: Array.isArray(parsed.goalSuggestions) ? parsed.goalSuggestions : [],
      noteCount: notes.length,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Model returned non-JSON despite the schema — degrade to plain summary.
    return text.trim()
      ? { summary: text.trim(), themes: [], goalSuggestions: [], noteCount: notes.length, generatedAt: new Date().toISOString() }
      : null;
  }
}

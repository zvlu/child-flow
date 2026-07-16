import { and, eq, inArray } from "drizzle-orm";
import {
  attendance,
  children,
  classrooms,
  enrollmentApplications,
  families,
  familyServices,
  healthRecords,
  pirData,
  pirQuestions,
  staff,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * PIR Auto-Population — the roadmap's "game-changer" (#1), web edition.
 *
 * Computes values for PIR catalog fields directly from the live program data
 * that staff already enter through daily workflows (enrollment, attendance,
 * health records, family services). Staff review each suggestion and apply
 * the ones they trust; nothing is written without an explicit apply.
 */

export type SmartFillConfidence = "high" | "medium";

export interface PirSuggestion {
  code: string; // pirQuestions.code
  section: string; // human section title (matches setPirValue input)
  subsection: string | null;
  label: string;
  value: string;
  source: string; // where the number came from
  confidence: SmartFillConfidence;
  currentValue: string | null; // already-saved answer for this year, if any
}

function ageInYears(dob: Date, asOf: Date): number {
  let years = asOf.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    asOf.getMonth() < dob.getMonth() ||
    (asOf.getMonth() === dob.getMonth() && asOf.getDate() < dob.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export async function computePirSuggestions(
  organizationId: number,
  year: string
): Promise<PirSuggestion[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Load live data in parallel ─────────────────────────────────────────
  const [kids, apps, health, familyRows, services, staffRows, classroomRows, attendanceRows] =
    await Promise.all([
      db
        .select({ id: children.id, dateOfBirth: children.dateOfBirth, status: children.status })
        .from(children)
        .where(eq(children.organizationId, organizationId)),
      db
        .select({ incomeLevel: enrollmentApplications.incomeLevel, status: enrollmentApplications.status })
        .from(enrollmentApplications)
        .where(eq(enrollmentApplications.organizationId, organizationId)),
      db
        .select({ childId: healthRecords.childId, type: healthRecords.type, status: healthRecords.status })
        .from(healthRecords)
        .where(eq(healthRecords.organizationId, organizationId)),
      db.select({ id: families.id }).from(families).where(eq(families.organizationId, organizationId)),
      db
        .select({ type: familyServices.type })
        .from(familyServices)
        .where(eq(familyServices.organizationId, organizationId)),
      db.select({ id: staff.id }).from(staff).where(eq(staff.organizationId, organizationId)),
      db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.organizationId, organizationId)),
      db
        .select({ status: attendance.status })
        .from(attendance)
        .where(eq(attendance.organizationId, organizationId)),
    ]);

  // ── Compute raw values keyed by PIR catalog code ───────────────────────
  const now = new Date();
  const active = kids.filter((k) => k.status === "active");

  const values = new Map<string, { value: number; source: string; confidence: SmartFillConfidence }>();
  const put = (code: string, value: number, source: string, confidence: SmartFillConfidence = "high") =>
    values.set(code, { value, source, confidence });

  // Section A — enrollment
  put("program_information.enrollment.actual_enrollment", active.length, "Active children on the roster");
  put(
    "program_information.enrollment.total_cumulative_enrollment",
    kids.length,
    "All child records (active + exited)",
    "medium"
  );
  if (attendanceRows.length > 0) {
    const attended = attendanceRows.reduce(
      (acc, r) => acc + (r.status === "present" ? 1 : r.status === "half_day" ? 0.5 : 0),
      0
    );
    put(
      "program_information.enrollment.avg_daily_attendance_pct",
      Math.round((attended / attendanceRows.length) * 100),
      `${attendanceRows.length} attendance records`
    );
  }

  // Section A — eligibility (from applications)
  const appsByIncome = (lvl: string) => apps.filter((a) => a.incomeLevel === lvl).length;
  if (apps.length > 0) {
    put(
      "program_information.eligibility.income_below_100_poverty",
      appsByIncome("below_100"),
      "Applications marked below 100% FPL",
      "medium"
    );
    put(
      "program_information.eligibility.between_100_130_poverty",
      appsByIncome("below_130"),
      "Applications marked 100–130% FPL",
      "medium"
    );
    put(
      "program_information.eligibility.over_income",
      appsByIncome("below_185") + appsByIncome("above_185"),
      "Applications above 130% FPL",
      "medium"
    );
  }

  // Section A — ages of active children
  const withDob = active.filter((k) => k.dateOfBirth != null);
  if (withDob.length > 0) {
    const bucket = (min: number, max: number) =>
      withDob.filter((k) => {
        const a = ageInYears(k.dateOfBirth!, now);
        return a >= min && a <= max;
      }).length;
    put("program_information.age.under_1", bucket(-1, 0), "Active children by date of birth");
    put("program_information.age.age_1", bucket(1, 1), "Active children by date of birth");
    put("program_information.age.age_2", bucket(2, 2), "Active children by date of birth");
    put("program_information.age.age_3", bucket(3, 3), "Active children by date of birth");
    put("program_information.age.age_4", bucket(4, 4), "Active children by date of birth");
    put("program_information.age.age_5_and_older", bucket(5, 99), "Active children by date of birth");
  }

  // Section A — transitions
  const withdrawn = kids.filter((k) => k.status === "withdrawn").length;
  if (withdrawn > 0) {
    put("program_information.transitions.children_who_left", withdrawn, "Children with withdrawn status", "medium");
  }

  // Section B — staff
  put("program_staff.counts.total_paid_staff", staffRows.length, "Staff roster");

  // Section C — preventive care (distinct children per record type/status)
  const distinct = (pred: (r: (typeof health)[number]) => boolean) =>
    new Set(health.filter(pred).map((r) => r.childId)).size;
  if (health.length > 0) {
    put(
      "child_family_services.preventive_care.immunizations_up_to_date",
      distinct((r) => r.type === "immunization" && r.status === "up_to_date"),
      "Immunization records marked up to date"
    );
    put(
      "child_family_services.preventive_care.received_medical_exam",
      distinct((r) => r.type === "physical"),
      "Children with a physical exam record"
    );
    put(
      "child_family_services.preventive_care.received_dental_exam",
      distinct((r) => r.type === "dental"),
      "Children with a dental record"
    );
  }

  // Section C — families & engagement
  put("child_family_services.families.total_families", familyRows.length, "Family records");
  const homeVisits = services.filter((s) => s.type === "home_visit").length;
  if (homeVisits > 0) {
    put("child_family_services.engagement.home_visits_completed", homeVisits, "Logged home visits");
  }

  // Section D — waitlist & facilities
  put(
    "grant_level.waiting_list.children_on_waiting_list",
    apps.filter((a) => a.status === "pending" || a.status === "reviewing").length,
    "Applications pending review"
  );
  put("grant_level.facilities.number_of_classrooms", classroomRows.length, "Classroom records");

  if (values.size === 0) return [];

  // ── Join with the catalog + existing answers for the year ─────────────
  const codes = Array.from(values.keys());
  const [catalogRows, existingRows] = await Promise.all([
    db
      .select({
        code: pirQuestions.code,
        section: pirQuestions.section,
        subsection: pirQuestions.subsection,
        label: pirQuestions.label,
      })
      .from(pirQuestions)
      .where(inArray(pirQuestions.code, codes)),
    db
      .select({ questionId: pirData.questionId, value: pirData.value })
      .from(pirData)
      .where(
        and(
          eq(pirData.organizationId, organizationId),
          eq(pirData.year, year),
          inArray(pirData.questionId, codes)
        )
      ),
  ]);

  const existing = new Map(existingRows.map((r) => [r.questionId, r.value]));

  return catalogRows
    .map((q) => {
      const v = values.get(q.code)!;
      return {
        code: q.code,
        section: q.section,
        subsection: q.subsection,
        label: q.label,
        value: String(v.value),
        source: v.source,
        confidence: v.confidence,
        currentValue: existing.get(q.code) ?? null,
      };
    })
    .sort((a, b) => a.section.localeCompare(b.section) || a.code.localeCompare(b.code));
}

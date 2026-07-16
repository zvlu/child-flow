/**
 * Seeds demo data for the Sprout feature set built on top of the base seed:
 * ERSEA applications, FPAs, §1302.17 incidents, Policy Council, disability
 * services, grant budget + expenses, in-kind match, and CLASS/ECERS scores.
 *
 * Additive + idempotent: clears ONLY these feature tables, then reuses the
 * families/children/classrooms created by scripts/seed.ts (run that first).
 *
 * Run: npx tsx scripts/seed-sprout-features.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import {
  children, families, classrooms,
  enrollmentApplications, familyPartnershipAgreements, suspensionExpulsionLogs,
  policyCouncilMembers, policyCouncilMeetings, disabilityServices,
  grantBudgetLines, grantExpenses, inKindContributions, classroomAssessments,
} from "../drizzle/schema";

const ORG = 1;
const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
const daysAhead = (n: number) => new Date(today.getTime() + n * 86400000);

const FEATURE_TABLES = [
  "classroom_assessments", "grant_expenses", "grant_budget_lines",
  "in_kind_contributions", "disability_services", "policy_council_meetings",
  "policy_council_members", "suspension_expulsion_logs",
  "family_partnership_agreements", "enrollment_applications",
];

function fiscalYear(): string {
  const start = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

async function main() {
  const pool = await mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool);

  const kids = await db.select().from(children).where(eq(children.organizationId, ORG));
  const fams = await db.select().from(families).where(eq(families.organizationId, ORG));
  const rooms = await db.select().from(classrooms).where(eq(classrooms.organizationId, ORG));
  if (kids.length < 3 || fams.length < 3 || rooms.length < 2) {
    console.error("Base data missing — run `npx tsx scripts/seed.ts` first.");
    process.exit(1);
  }

  console.log("Clearing Sprout feature tables…");
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of FEATURE_TABLES) await pool.query(`TRUNCATE TABLE \`${t}\``);
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  // ── ERSEA applications (waitlist scoring + eligibility bands) ───────────
  console.log("Seeding enrollment applications…");
  await db.insert(enrollmentApplications).values([
    { organizationId: ORG, childFirstName: "Amara", childLastName: "Diallo", dateOfBirth: daysAgo(3 * 365 + 40), gender: "female", parentName: "Fatou Diallo", parentPhone: "(916) 555-0121", incomeLevel: "below_100", householdSize: 5, priority: "high", status: "pending", notes: "Eligibility: Categorically eligible (62% FPL) — Experiencing homelessness (McKinney-Vento)", appliedDate: daysAgo(95) },
    { organizationId: ORG, childFirstName: "Mateo", childLastName: "Reyes", dateOfBirth: daysAgo(4 * 365 + 10), gender: "male", parentName: "Lucia Reyes", parentPhone: "(916) 555-0134", incomeLevel: "below_100", householdSize: 4, priority: "high", status: "reviewing", notes: "Eligibility: Categorically eligible (88% FPL) — Child in foster care", appliedDate: daysAgo(60) },
    { organizationId: ORG, childFirstName: "Lien", childLastName: "Pham", dateOfBirth: daysAgo(3 * 365 + 200), gender: "female", parentName: "Thu Pham", parentPhone: "(916) 555-0158", incomeLevel: "below_130", householdSize: 6, priority: "medium", status: "pending", notes: "Eligibility: Eligible under the 130% provision (118% FPL)", appliedDate: daysAgo(30) },
    { organizationId: ORG, childFirstName: "Jonah", childLastName: "Whitfield", dateOfBirth: daysAgo(4 * 365 + 100), gender: "male", parentName: "Grace Whitfield", parentPhone: "(916) 555-0177", incomeLevel: "below_100", householdSize: 3, priority: "medium", status: "approved", notes: "Eligibility: Income eligible (74% FPL) — has IEP/IFSP", appliedDate: daysAgo(120) },
    { organizationId: ORG, childFirstName: "Yusuf", childLastName: "Hassan", dateOfBirth: daysAgo(3 * 365 + 300), gender: "male", parentName: "Amina Hassan", parentPhone: "(916) 555-0191", incomeLevel: "above_185", householdSize: 4, priority: "low", status: "pending", notes: "Eligibility: Over income (204% FPL)", appliedDate: daysAgo(15) },
  ]);

  // ── Family Partnership Agreements ────────────────────────────────────
  console.log("Seeding FPAs…");
  await db.insert(familyPartnershipAgreements).values([
    { organizationId: ORG, familyId: fams[0].id, status: "active", strengths: ["Strong extended-family support", "Consistent attendance", "Parent employed full-time"], needsAssessment: "Family seeking stable housing near the center; interested in GED classes for the father.", targetVisits: 4, parentSigned: 1, parentSignedAt: daysAgo(80), staffSigned: 1, staffSignedAt: daysAgo(80), reviewDate: daysAhead(40) },
    { organizationId: ORG, familyId: fams[1].id, status: "review_due", strengths: ["Bilingual household", "Engaged in classroom volunteering"], needsAssessment: "Transportation barrier on Fridays; exploring bus voucher program.", targetVisits: 4, parentSigned: 1, parentSignedAt: daysAgo(200), staffSigned: 1, staffSignedAt: daysAgo(200), reviewDate: daysAgo(10) },
    { organizationId: ORG, familyId: fams[2].id, status: "draft", strengths: ["Motivated to complete nursing certification"], needsAssessment: null, targetVisits: 2, parentSigned: 0, staffSigned: 1, staffSignedAt: daysAgo(5), reviewDate: daysAhead(90) },
  ]);

  // ── §1302.17 incidents ──────────────────────────────────────────────
  console.log("Seeding suspension/expulsion log…");
  await db.insert(suspensionExpulsionLogs).values([
    { organizationId: ORG, childId: kids[0].id, incidentDate: daysAgo(12), type: "expulsion_prevented", description: "Repeated aggressive outbursts during transitions. Behavior support plan initiated with family; exclusion avoided.", stepsTaken: ["mental_health_consult", "parent_meeting", "individualized_supports"], status: "resolved", resolvedAt: daysAgo(4) },
    { organizationId: ORG, childId: kids[1].id, incidentDate: daysAgo(3), type: "temporary_suspension", description: "Half-day suspension after biting incidents; safety plan under development with the family.", stepsTaken: ["parent_meeting"], status: "open" },
  ]);

  // ── Policy Council ───────────────────────────────────────────────────
  console.log("Seeding Policy Council…");
  await db.insert(policyCouncilMembers).values([
    { organizationId: ORG, name: "Maria Gutierrez", memberType: "parent", councilRole: "chair", familyId: fams[0].id, termStart: daysAgo(120) },
    { organizationId: ORG, name: "Denise Walker", memberType: "parent", councilRole: "secretary", familyId: fams[1].id, termStart: daysAgo(120) },
    { organizationId: ORG, name: "Tran Nguyen", memberType: "parent", councilRole: "member", familyId: fams[2].id, termStart: daysAgo(90) },
    { organizationId: ORG, name: "Rev. James Okafor", memberType: "community_rep", councilRole: "member", termStart: daysAgo(120) },
    { organizationId: ORG, name: "Sandra Kim (United Way)", memberType: "community_rep", councilRole: "treasurer", termStart: daysAgo(120) },
  ]);
  await db.insert(policyCouncilMeetings).values([
    { organizationId: ORG, meetingDate: daysAgo(75), title: "Program Year Kickoff", minutes: "Reviewed program goals and self-assessment findings. Approved meeting calendar. Elected officers.", attendeeCount: 9, quorumMet: 1, actionItems: ["Distribute parent handbook translations", "Schedule budget training for new members"] },
    { organizationId: ORG, meetingDate: daysAgo(45), title: "Budget & Enrollment Review", minutes: "Reviewed monthly financials and enrollment at 97% of funded slots. Discussed recruitment push in the north neighborhoods.", attendeeCount: 8, quorumMet: 1, actionItems: ["Approve revised transportation line item"] },
    { organizationId: ORG, meetingDate: daysAgo(14), title: "Mid-Year Program Update", minutes: "CLASS observation results shared. Voted 7-1 to approve the updated CACFP menu cycle. Parent activity fund reviewed.", attendeeCount: 7, quorumMet: 1, actionItems: ["Post minutes to family board", "Invite LEA liaison to next meeting"] },
  ]);

  // ── Disability services (10% requirement) ───────────────────────────
  console.log("Seeding disability services…");
  await db.insert(disabilityServices).values([
    { organizationId: ORG, childId: kids[0].id, planType: "iep", status: "active", primaryDisability: "Speech/language impairment", effectiveDate: daysAgo(200), expirationDate: daysAhead(20), leaAgency: "Sacramento County Office of Education", leaContact: "L. Brooks (916) 555-0201", parentRightsNotifiedAt: daysAgo(198), parentRightsLanguage: "Español", transitionChecklist: ["records_consent", "lea_meeting"] },
    { organizationId: ORG, childId: kids[2].id, planType: "ifsp", status: "active", primaryDisability: "Developmental delay", effectiveDate: daysAgo(100), expirationDate: daysAhead(160), leaAgency: "Alta California Regional Center", leaContact: "D. Fuentes (916) 555-0233", parentRightsNotifiedAt: daysAgo(98), parentRightsLanguage: "English", transitionChecklist: [] },
    { organizationId: ORG, childId: kids[3 % kids.length].id, planType: "iep", status: "pending_evaluation", primaryDisability: "Suspected hearing impairment", effectiveDate: null, expirationDate: null, leaAgency: "Sacramento County Office of Education", leaContact: null, transitionChecklist: [] },
  ]);

  // ── Grant budget + expenses + in-kind match ──────────────────────────
  console.log("Seeding grant budget…");
  const fy = fiscalYear();
  const usd = (dollars: number) => Math.round(dollars * 100); // dollars → cents
  await db.insert(grantBudgetLines).values([
    { organizationId: ORG, fiscalYear: fy, category: "education", budgetedCents: usd(420_000) },
    { organizationId: ORG, fiscalYear: fy, category: "health", budgetedCents: usd(95_000) },
    { organizationId: ORG, fiscalYear: fy, category: "family_services", budgetedCents: usd(130_000) },
    { organizationId: ORG, fiscalYear: fy, category: "program_management", budgetedCents: usd(160_000) },
    { organizationId: ORG, fiscalYear: fy, category: "transportation", budgetedCents: usd(50_000) },
    { organizationId: ORG, fiscalYear: fy, category: "tta", budgetedCents: usd(30_000) },
  ]);
  await db.insert(grantExpenses).values([
    { organizationId: ORG, fiscalYear: fy, category: "education", description: "Teaching staff payroll — fall quarter", amountCents: usd(150_000), expenseDate: daysAgo(90), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "education", description: "Curriculum materials & classroom supplies", amountCents: usd(18_000), expenseDate: daysAgo(70), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "health", description: "Contracted health screenings (45-day)", amountCents: usd(21_000), expenseDate: daysAgo(60), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "family_services", description: "Family advocate payroll — fall", amountCents: usd(42_000), expenseDate: daysAgo(55), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "program_management", description: "Admin payroll + audit prep", amountCents: usd(54_000), expenseDate: daysAgo(45), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "transportation", description: "Bus fuel & maintenance", amountCents: usd(12_000), expenseDate: daysAgo(30), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "tta", description: "CLASS observer certification training", amountCents: usd(6_000), expenseDate: daysAgo(20), nonFederalShare: 0 },
    { organizationId: ORG, fiscalYear: fy, category: "facilities", description: "Donated classroom renovation labor (church volunteers)", amountCents: usd(15_000), expenseDate: daysAgo(40), nonFederalShare: 1 },
  ]);
  await db.insert(inKindContributions).values([
    { organizationId: ORG, type: "volunteer", contributor: "Parent volunteers (classroom + field trips)", description: "1,240 hours @ $18.50", date: daysAgo(30), hours: "1240.00", value: "22940.00" },
    { organizationId: ORG, type: "facility", contributor: "First Baptist Church", description: "Donated space for parent meetings", date: daysAgo(50), value: "9600.00" },
    { organizationId: ORG, type: "goods", contributor: "Sacramento Food Bank", description: "Family food boxes", date: daysAgo(15), value: "5400.00" },
  ]);

  // ── CLASS / ECERS observations (improving trend) ─────────────────────
  console.log("Seeding classroom quality…");
  const classScores = (es: number, co: number, is: number) => ({
    positive_climate: es + 1 > 7 ? 7 : es + 1, negative_climate: 2, teacher_sensitivity: es, regard_perspectives: es - 1,
    behavior_management: co, productivity: co, instructional_formats: co - 1,
    concept_development: is, quality_feedback: is, language_modeling: is + 1 > 7 ? 7 : is + 1,
  });
  await db.insert(classroomAssessments).values([
    { organizationId: ORG, classroomId: rooms[0].id, tool: "class", assessmentDate: daysAgo(150), observer: "R. Alvarez (certified)", scores: classScores(5, 5, 2), coachingNotes: "Focus area: open-ended questioning during centers." },
    { organizationId: ORG, classroomId: rooms[0].id, tool: "class", assessmentDate: daysAgo(75), observer: "R. Alvarez (certified)", scores: classScores(6, 5, 3), coachingNotes: "Strong growth in feedback loops; keep modeling rich vocabulary." },
    { organizationId: ORG, classroomId: rooms[0].id, tool: "class", assessmentDate: daysAgo(10), observer: "R. Alvarez (certified)", scores: classScores(6, 6, 3), coachingNotes: "ES and CO above competitive threshold; IS at 3.0 — continue concept-development coaching." },
    { organizationId: ORG, classroomId: rooms[1].id, tool: "class", assessmentDate: daysAgo(20), observer: "R. Alvarez (certified)", scores: classScores(6, 6, 2), coachingNotes: "Schedule instructional-support coaching cycle for spring." },
    { organizationId: ORG, classroomId: rooms[1].id, tool: "ecers", assessmentDate: daysAgo(35), observer: "M. Chen", scores: { space_furnishings: 6, personal_care: 5, language_literacy: 6, learning_activities: 5, interaction: 7, program_structure: 6 }, coachingNotes: "Add more fine-motor materials to the manipulatives area." },
  ]);

  console.log("✅ Sprout feature data seeded. Refresh the app — every new page now has data.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

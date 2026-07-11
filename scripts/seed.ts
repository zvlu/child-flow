/**
 * Seed script: populates the ChildFlow database with realistic demo data
 * for a Head Start program. Idempotent-ish: truncates all tables first.
 *
 * Run: npx tsx scripts/seed.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { hashPassword } from "../server/_core/password";
import {
  users, organizations, families, children, staff, classrooms,
  childClassroomAssignments, staffCaseloads, attendance, healthRecords,
  familyServices, communicationLogs, educationRecords, pirData, pirReports, pirQuestions, studentNotes,
  calendarEvents, familyContactAddresses, documents, bulkActionLogs,
  aiInsights, invoices, payments, activityLogs, parentNotifications,
  digitalDocuments, mealPlans, mealItems, cacfpReports, timeClock,
  certifications, customReports,
  conversations, chatMessages, familyCaseNotes, familyGoals,
} from "../drizzle/schema";

const TABLES = [
  "chat_messages", "conversations", "family_case_notes", "family_goals",
  "reportResults", "customReports", "certifications", "timeClock",
  "cacfpReports", "mealItems", "mealPlans", "digitalDocuments",
  "parentNotifications", "activityLogs", "payments", "invoices",
  "ai_insights", "bulk_action_logs", "documents", "family_contact_addresses",
  "calendar_events", "student_notes", "staff_caseloads",
  "child_classroom_assignments", "pir_data", "pir_reports", "education_records",
  "communication_logs", "family_services", "health_records", "attendance",
  "classrooms", "children", "families", "staff", "organizations", "users",
];

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
const daysAhead = (n: number) => new Date(today.getTime() + n * 86400000);
const at = (d: Date, h: number, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};
const dateStr = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const pool = await mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool);

  console.log("Clearing existing data…");
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of TABLES) await pool.query(`TRUNCATE TABLE \`${t}\``);
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log("Seeding users…");
  // Demo password for the seeded accounts so the mobile email/password login
  // works out of the box. Override with SEED_DEMO_PASSWORD.
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "ChildFlow!2026";
  const [adminHash, staffHash] = await Promise.all([
    hashPassword(demoPassword),
    hashPassword(demoPassword),
  ]);
  await db.insert(users).values([
    { openId: "dev-test-user", name: "Test Administrator", email: "admin@childflow.org", loginMethod: "email", role: "admin", passwordHash: adminHash },
    { openId: "user-maria", name: "Maria Lopez", email: "maria.lopez@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    // Parent accounts power the family side of chat threads (users 3 & 4).
    { openId: "parent-garcia", name: "Carmen Garcia", email: "carmen.garcia@example.com", loginMethod: "email", role: "parent", familyId: 1, passwordHash: staffHash },
    { openId: "parent-nguyen", name: "Linh Nguyen", email: "linh.nguyen@example.com", loginMethod: "email", role: "parent", familyId: 2, passwordHash: staffHash },
    // One login per staff member (users 5-12) so every §1302.91 role can be
    // exercised: sign in as the nurse, the nutritionist, an advocate, etc.
    // staff.userId links these to their staff rows below.
    { openId: "staff-diana", name: "Diana Reyes", email: "diana.reyes@childflow.org", loginMethod: "email", role: "admin", passwordHash: staffHash },
    { openId: "staff-james", name: "James Mitchell", email: "james.mitchell@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    { openId: "staff-aisha", name: "Aisha Johnson", email: "aisha.johnson@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    { openId: "staff-sofia", name: "Sofia Hernandez", email: "sofia.hernandez@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    { openId: "staff-marcus", name: "Marcus Webb", email: "marcus.webb@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    { openId: "staff-linda", name: "Linda Tran", email: "linda.tran@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    { openId: "staff-rachel", name: "Rachel Kim", email: "rachel.kim@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
    { openId: "staff-carlos", name: "Carlos Mendoza", email: "carlos.mendoza@childflow.org", loginMethod: "email", role: "staff", passwordHash: staffHash },
  ]);
  console.log(`  Demo login → admin@childflow.org / ${demoPassword}`);

  console.log("Seeding organization…");
  await db.insert(organizations).values({
    name: "Sunshine Head Start Center",
    agencyId: "HS-CA-04217",
    description: "Federally funded Head Start program serving 120 children across 6 classrooms in Sacramento County.",
    ownerId: 1,
    subscriptionTier: "professional",
    maxChildren: 150,
    maxStaff: 30,
    // Demo org is a Head Start program — module on so the full demo works.
    enabledModules: ["head_start"],
  });
  const ORG = 1;
  // Bind the seeded staff accounts to the org so tenant scoping resolves to a
  // real organization (the REST layer no longer falls back to "first org").
  // Only the two staff users exist at this point, so an unfiltered update is safe.
  await db.update(users).set({ organizationId: ORG });

  console.log("Seeding staff…");
  const staffRows = [
    ["Diana", "Reyes", "Center Director", "director"],
    ["James", "Mitchell", "Lead Teacher", "teacher"],
    ["Aisha", "Johnson", "Education Coordinator", "education_coordinator"],
    ["Sofia", "Hernandez", "Teacher Assistant", "assistant"],
    ["Marcus", "Webb", "Nutritionist (RD)", "nutritionist"],
    ["Linda", "Tran", "Family Advocate", "family_advocate"],
    ["Rachel", "Kim", "Program Nurse (RN)", "nurse"],
    ["Carlos", "Mendoza", "Family Advocate", "family_advocate"],
  ] as const;
  await db.insert(staff).values(staffRows.map(([firstName, lastName, position, role], i) => ({
    organizationId: ORG, firstName, lastName, position, role,
    userId: 5 + i, // staff logins seeded above, same order
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@childflow.org`,
    phone: `(916) 555-0${100 + i}`,
  })));

  console.log("Seeding families…");
  const familyRows = [
    ["Angela Martinez", "Roberto Martinez", "2847 Maple Grove Ave"],
    ["Keisha Williams", null, "1532 Oak Street Apt 4B"],
    ["Jennifer Chen", "David Chen", "984 Riverside Dr"],
    ["Fatima Al-Hassan", "Omar Al-Hassan", "445 Sunset Blvd"],
    ["Brittany Cooper", null, "2210 Elm Court"],
    ["Rosa Gutierrez", "Miguel Gutierrez", "678 Willow Lane"],
    ["Sarah Thompson", "Mike Thompson", "1190 Birch Road"],
    ["Mai Nguyen", "Tuan Nguyen", "356 Cedar Ave Apt 12"],
    ["Destiny Jackson", null, "789 Pine Street"],
    ["Carmen Rivera", "Luis Rivera", "1024 Spruce Way"],
    ["Emily Davis", null, "467 Aspen Circle"],
    ["Gabriela Santos", "Pedro Santos", "1845 Magnolia Dr"],
  ] as const;
  await db.insert(families).values(familyRows.map(([primary, secondary, address], i) => ({
    organizationId: ORG,
    primaryContactName: primary,
    primaryContactPhone: `(916) 555-1${200 + i}`,
    primaryContactEmail: `${primary.split(" ")[0].toLowerCase()}.${primary.split(" ")[1].toLowerCase()}@email.com`,
    secondaryContactName: secondary,
    secondaryContactPhone: secondary ? `(916) 555-2${300 + i}` : null,
    address, city: "Sacramento", state: "CA", zipCode: `958${10 + i}`,
  })));

  console.log("Seeding classrooms…");
  await db.insert(classrooms).values([
    { organizationId: ORG, name: "Butterflies", ageGroup: "Preschool (3-4)", capacity: 18, teacherId: 2, assistantId: 4, color: "#f59e0b" },
    { organizationId: ORG, name: "Caterpillars", ageGroup: "Toddlers (2-3)", capacity: 14, teacherId: 3, assistantId: 5, color: "#10b981" },
    { organizationId: ORG, name: "Dragonflies", ageGroup: "Pre-K (4-5)", capacity: 20, teacherId: 8, color: "#3b82f6" },
    { organizationId: ORG, name: "Ladybugs", ageGroup: "Preschool (3-4)", capacity: 16, teacherId: 2, color: "#ef4444" },
  ]);
  await db.insert(staffCaseloads).values([
    { staffId: 2, classroomId: 1, role: "teacher" },
    { staffId: 4, classroomId: 1, role: "assistant" },
    { staffId: 3, classroomId: 2, role: "teacher" },
    { staffId: 5, classroomId: 2, role: "assistant" },
    { staffId: 8, classroomId: 3, role: "teacher" },
    { staffId: 2, classroomId: 4, role: "teacher" },
  ]);

  console.log("Seeding children…");
  const childRows: Array<[string, string, number, "male" | "female", number, number]> = [
    // first, last, ageMonths, gender, familyId, classroomId
    ["Isabella", "Martinez", 46, "female", 1, 1],
    ["Diego", "Martinez", 30, "male", 1, 2],
    ["Jayden", "Williams", 44, "male", 2, 1],
    ["Lily", "Chen", 52, "female", 3, 3],
    ["Amir", "Al-Hassan", 49, "male", 4, 3],
    ["Layla", "Al-Hassan", 33, "female", 4, 2],
    ["Madison", "Cooper", 41, "female", 5, 1],
    ["Mateo", "Gutierrez", 55, "male", 6, 3],
    ["Valentina", "Gutierrez", 38, "female", 6, 4],
    ["Noah", "Thompson", 47, "male", 7, 1],
    ["An", "Nguyen", 53, "female", 8, 3],
    ["Zion", "Jackson", 35, "male", 9, 2],
    ["Sofia", "Rivera", 50, "female", 10, 3],
    ["Lucas", "Rivera", 29, "male", 10, 2],
    ["Ava", "Davis", 43, "female", 11, 4],
    ["Thiago", "Santos", 48, "male", 12, 3],
    ["Camila", "Santos", 31, "female", 12, 2],
    ["Ethan", "Williams", 58, "male", 2, 3],
    ["Mia", "Thompson", 36, "female", 7, 4],
    ["Aaliyah", "Jackson", 54, "female", 9, 3],
  ];
  await db.insert(children).values(childRows.map(([firstName, lastName, ageMonths, gender, familyId]) => ({
    organizationId: ORG, firstName, lastName, gender, familyId,
    dateOfBirth: daysAgo(Math.round(ageMonths * 30.4)),
    enrollmentDate: daysAgo(120 + Math.floor(Math.random() * 200)),
    status: "active" as const,
  })));
  await db.insert(childClassroomAssignments).values(
    childRows.map(([, , , , , classroomId], i) => ({
      childId: i + 1, classroomId, assignmentDate: daysAgo(120),
    }))
  );

  console.log("Seeding attendance (last 30 weekdays)…");
  const attendanceRows: (typeof attendance.$inferInsert)[] = [];
  let weekdayCount = 0;
  for (let d = 0; weekdayCount < 30; d++) {
    const day = daysAgo(d);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    weekdayCount++;
    childRows.forEach((_, i) => {
      const roll = (i * 7 + weekdayCount * 13) % 20;
      const status = roll === 0 ? "absent" : roll === 1 ? "excused" : roll === 2 ? "half_day" : "present";
      attendanceRows.push({
        childId: i + 1, organizationId: ORG, date: at(day, 0),
        status,
        checkInTime: status === "absent" || status === "excused" ? null : at(day, 7, 30 + (i % 45)),
        checkOutTime: status === "absent" || status === "excused" ? null : at(day, status === "half_day" ? 11 : 15, 30),
        recordedBy: 2,
      });
    });
  }
  await db.insert(attendance).values(attendanceRows);

  console.log("Seeding health records…");
  const healthTypes = ["immunization", "physical", "dental", "vision", "hearing"] as const;
  const healthRows: (typeof healthRecords.$inferInsert)[] = [];
  childRows.forEach((_, i) => {
    healthTypes.forEach((type, t) => {
      const roll = (i * 5 + t) % 10;
      const status = roll < 6 ? "up_to_date" : roll < 8 ? "due_soon" : "overdue";
      healthRows.push({
        childId: i + 1, organizationId: ORG, type, status,
        recordDate: daysAgo(90 + ((i * 17 + t * 31) % 200)),
        expiryDate: status === "up_to_date" ? daysAhead(90 + ((i * 11) % 200))
          : status === "due_soon" ? daysAhead(5 + ((i * 3 + t) % 20))
          : daysAgo(3 + ((i * 7 + t) % 25)),
        provider: ["Valley Pediatrics", "Sacramento Smiles Dental", "ClearView Optometry", "County Health Clinic"][(i + t) % 4],
        recordedBy: 7,
      });
    });
  });
  await db.insert(healthRecords).values(healthRows);

  console.log("Seeding family services…");
  await db.insert(familyServices).values([
    { familyId: 1, organizationId: ORG, type: "home_visit", serviceDate: daysAgo(12), description: "Fall home visit — reviewed family goals and Isabella's progress.", outcome: "Family engaged; mother interested in ESL classes.", followUpRequired: 1, followUpDate: daysAhead(18), recordedBy: 6 },
    { familyId: 2, organizationId: ORG, type: "referral", serviceDate: daysAgo(8), description: "Referred to Sacramento Housing Alliance for rental assistance.", outcome: "Application submitted; awaiting response.", followUpRequired: 1, followUpDate: daysAhead(7), recordedBy: 6 },
    { familyId: 4, organizationId: ORG, type: "office_visit", serviceDate: daysAgo(5), description: "Discussed Layla's transition plan to preschool classroom.", outcome: "Transition scheduled for next month.", recordedBy: 6 },
    { familyId: 5, organizationId: ORG, type: "phone_call", serviceDate: daysAgo(3), description: "Check-in re: Madison's attendance gaps.", outcome: "Transportation issue identified; bus route info shared.", followUpRequired: 1, followUpDate: daysAhead(10), recordedBy: 6 },
    { familyId: 6, organizationId: ORG, type: "referral", serviceDate: daysAgo(20), description: "WIC re-enrollment referral for both children.", outcome: "Completed — family re-enrolled.", recordedBy: 6 },
    { familyId: 9, organizationId: ORG, type: "home_visit", serviceDate: daysAgo(2), description: "Family partnership agreement update; discussed employment goals.", outcome: "Resume workshop scheduled.", followUpRequired: 1, followUpDate: daysAhead(14), recordedBy: 6 },
  ]);

  console.log("Seeding communication logs…");
  await db.insert(communicationLogs).values([
    { organizationId: ORG, recipientId: 1, type: "email", subject: "Parent-Teacher Conference Reminder", content: "Hi Angela, this is a reminder that Isabella's fall conference is scheduled for Thursday at 3:30 PM.", status: "sent", sentAt: daysAgo(4) },
    { organizationId: ORG, recipientId: 3, type: "sms", content: "Reminder: Lily's dental screening form is due Friday. Please send it in her backpack. — Sunshine HS", status: "sent", sentAt: daysAgo(3) },
    { organizationId: ORG, recipientId: 5, type: "sms", content: "Hi Brittany — Madison was marked absent today. Please call the office if she'll be out this week.", status: "sent", sentAt: daysAgo(2) },
    { organizationId: ORG, recipientId: 2, type: "email", subject: "Housing referral follow-up", content: "Keisha, following up on the housing application we submitted. The alliance may call you this week.", status: "sent", sentAt: daysAgo(1) },
    { organizationId: ORG, recipientId: 1, type: "broadcast", subject: "Center closed Friday", content: "Sunshine Head Start will be closed this Friday for staff in-service training. Classes resume Monday.", status: "sent", sentAt: daysAgo(6) },
  ]);

  console.log("Seeding education records…");
  await db.insert(educationRecords).values([
    { childId: 1, organizationId: ORG, type: "assessment", title: "DRDP Fall Assessment", description: "Desired Results Developmental Profile — fall window.", assessmentDate: daysAgo(45), score: "Building Middle", recordedBy: 2 },
    { childId: 4, organizationId: ORG, type: "assessment", title: "DRDP Fall Assessment", description: "Strong language and literacy domain scores.", assessmentDate: daysAgo(44), score: "Building Later", recordedBy: 8 },
    { childId: 8, organizationId: ORG, type: "parent_conference", title: "Fall Parent Conference", description: "Reviewed Mateo's kindergarten readiness goals with parents.", assessmentDate: daysAgo(30), recordedBy: 8 },
    { childId: 12, organizationId: ORG, type: "individual_plan", title: "Individualized Learning Plan", description: "Focus areas: expressive language, peer play.", assessmentDate: daysAgo(25), recordedBy: 3 },
    { childId: 3, organizationId: ORG, type: "home_visit", title: "Educational Home Visit", description: "Shared at-home literacy activities with family.", assessmentDate: daysAgo(15), recordedBy: 2 },
  ]);

  console.log("Seeding PIR reports + data…");
  // Question *definitions* live in pir_questions (run scripts/seed-pir-questions.ts).
  // Demo *values* are keyed by catalog code so they appear in the PIR editor/viewer.
  const pirSectionByCode = new Map(
    (await db.select({ code: pirQuestions.code, section: pirQuestions.section }).from(pirQuestions))
      .map((q) => [q.code, q.section] as const),
  );
  if (pirSectionByCode.size === 0) {
    console.warn("  ⚠ pir_questions is empty — run `npx tsx scripts/seed-pir-questions.ts` first so PIR demo values map to the catalog.");
  }
  const pirValues: Record<string, string | number> = {
    "program_information.structure.program_type": "Head Start",
    "program_information.structure.center_based_count": 96,
    "program_information.enrollment.funded_enrollment": 120,
    "program_information.enrollment.total_cumulative_enrollment": 138,
    "program_information.enrollment.avg_daily_attendance_pct": 89,
    "program_information.eligibility.income_below_100_poverty": 96,
    "program_information.age.age_3": 40,
    "program_information.age.age_4": 78,
    "program_information.race_ethnicity.hispanic_latino": 71,
    "program_staff.counts.total_paid_staff": 24,
    "program_staff.teaching_qualifications.total_teachers": 12,
    "program_staff.teaching_qualifications.baccalaureate_degree": 9,
    "program_staff.turnover.departed_during_year": 3,
    "child_family_services.health_insurance_access.medical_home_eoy": 131,
    "child_family_services.preventive_care.immunizations_up_to_date": 129,
    "child_family_services.bmi.healthy_weight": 92,
    "child_family_services.families.total_families": 132,
    "child_family_services.family_services.housing_assistance": 14,
    "child_family_services.disabilities.iep_ifsp_total": 18,
    "grant_level.grant.total_approved_enrollment": 120,
    "grant_level.facilities.number_of_centers": 6,
    "grant_level.facilities.cacfp_participation": "true",
  };
  // Current year is a partial, in-progress draft; prior years are finished reports.
  const pirReportSeed = [
    { year: "2025-2026", status: "draft" as const, submittedAt: null as Date | null, codes: Object.keys(pirValues).slice(0, 9) },
    { year: "2024-2025", status: "submitted" as const, submittedAt: daysAgo(120), codes: Object.keys(pirValues) },
    { year: "2023-2024", status: "accepted" as const, submittedAt: daysAgo(500), codes: Object.keys(pirValues) },
    { year: "2022-2023", status: "accepted" as const, submittedAt: daysAgo(860), codes: Object.keys(pirValues) },
  ];
  for (let i = 0; i < pirReportSeed.length; i++) {
    const r = pirReportSeed[i];
    const [res] = await db.insert(pirReports).values({ organizationId: ORG, year: r.year, status: r.status, submittedAt: r.submittedAt });
    const reportId = res.insertId;
    const rows = r.codes
      .filter((code) => pirSectionByCode.has(code))
      .map((code) => {
        const raw = pirValues[code];
        const value = typeof raw === "number" ? String(Math.max(0, raw - i * 2)) : raw;
        return { organizationId: ORG, year: r.year, section: pirSectionByCode.get(code)!, questionId: code, value, reportId, updatedBy: 1 };
      });
    if (rows.length) await db.insert(pirData).values(rows);
  }

  console.log("Seeding student notes…");
  await db.insert(studentNotes).values([
    { childId: 1, organizationId: ORG, title: "Peanut allergy", content: "Severe peanut allergy — EpiPen in front office. All snacks must be checked.", priority: "critical", isPinned: 1, category: "Allergy", createdBy: 7 },
    { childId: 7, organizationId: ORG, title: "Pickup restriction", content: "Only mother (Brittany Cooper) and grandmother authorized for pickup. See office for court documentation.", priority: "high", isPinned: 1, category: "Safety", createdBy: 1 },
    { childId: 12, organizationId: ORG, title: "Speech therapy Tuesdays", content: "Zion leaves at 1 PM every Tuesday for speech therapy with county provider.", priority: "medium", category: "Medical", createdBy: 3 },
    { childId: 4, organizationId: ORG, title: "Advanced reader", content: "Lily is reading early sight words — provide extension activities during literacy block.", priority: "low", category: "General", createdBy: 8 },
  ]);

  console.log("Seeding calendar events…");
  await db.insert(calendarEvents).values([
    { organizationId: ORG, title: "Staff In-Service Training", eventType: "staff_training", startDate: daysAhead(3), location: "Main Center", color: "#8b5cf6", createdBy: 1 },
    { organizationId: ORG, title: "Parent Advisory Committee Meeting", eventType: "parent_event", startDate: at(daysAhead(7), 18), allDay: 0, location: "Community Room", color: "#10b981", createdBy: 6 },
    { organizationId: ORG, title: "Vision & Hearing Screenings", eventType: "deadline", startDate: daysAhead(10), endDate: daysAhead(12), location: "Health Office", color: "#ef4444", createdBy: 7 },
    { organizationId: ORG, title: "Fall Family Festival", eventType: "school_event", startDate: at(daysAhead(16), 10), allDay: 0, location: "Playground", color: "#f59e0b", createdBy: 1 },
    { organizationId: ORG, title: "Thanksgiving Break — Center Closed", eventType: "holiday", startDate: daysAhead(20), endDate: daysAhead(24), color: "#64748b", createdBy: 1 },
    { organizationId: ORG, title: "PIR Data Submission Deadline", eventType: "deadline", startDate: daysAhead(30), color: "#ef4444", createdBy: 1 },
    { organizationId: ORG, title: "Dragonflies Field Trip — Discovery Museum", eventType: "school_event", startDate: at(daysAhead(9), 9), allDay: 0, classroomId: 3, location: "Discovery Museum", color: "#3b82f6", createdBy: 8 },
  ]);

  console.log("Seeding family contact addresses…");
  await db.insert(familyContactAddresses).values([
    { familyId: 1, contactName: "Angela Martinez", relationship: "Mother", phone: "(916) 555-1201", email: "angela.martinez@email.com", address: "2847 Maple Grove Ave", city: "Sacramento", state: "CA", zipCode: "95811", isPrimary: 1 },
    { familyId: 1, contactName: "Gloria Reyes", relationship: "Grandmother", phone: "(916) 555-3401", address: "112 Walnut St", city: "Sacramento", state: "CA", zipCode: "95815" },
    { familyId: 5, contactName: "Brittany Cooper", relationship: "Mother", phone: "(916) 555-1205", email: "brittany.cooper@email.com", address: "2210 Elm Court", city: "Sacramento", state: "CA", zipCode: "95814", isPrimary: 1 },
  ]);

  console.log("Seeding documents…");
  await db.insert(documents).values([
    { childId: 1, organizationId: ORG, documentType: "birth_certificate", fileName: "isabella_martinez_birth_cert.pdf", fileUrl: "/files/demo/isabella_birth_cert.pdf", fileSize: 245000, mimeType: "application/pdf", uploadedBy: 1, uploadedAt: daysAgo(140) },
    { childId: 1, organizationId: ORG, documentType: "immunization_record", fileName: "isabella_martinez_immunizations.pdf", fileUrl: "/files/demo/isabella_imm.pdf", fileSize: 180000, mimeType: "application/pdf", expiryDate: daysAhead(180), uploadedBy: 7, uploadedAt: daysAgo(90) },
    { childId: 4, organizationId: ORG, documentType: "medical_record", fileName: "lily_chen_physical_2025.pdf", fileUrl: "/files/demo/lily_physical.pdf", fileSize: 320000, mimeType: "application/pdf", expiryDate: daysAhead(250), uploadedBy: 7, uploadedAt: daysAgo(60) },
    { childId: 7, organizationId: ORG, documentType: "consent_form", fileName: "madison_cooper_photo_consent.pdf", fileUrl: "/files/demo/madison_consent.pdf", fileSize: 95000, mimeType: "application/pdf", uploadedBy: 2, uploadedAt: daysAgo(110) },
    { childId: 8, organizationId: ORG, documentType: "assessment", fileName: "mateo_gutierrez_drdp_fall.pdf", fileUrl: "/files/demo/mateo_drdp.pdf", fileSize: 410000, mimeType: "application/pdf", uploadedBy: 8, uploadedAt: daysAgo(40) },
  ]);

  console.log("Seeding bulk action logs…");
  await db.insert(bulkActionLogs).values([
    { organizationId: ORG, classroomId: 1, actionType: "bulk_attendance", description: "Marked all Butterflies present for field day", recordCount: 16, status: "completed", performedBy: 2, actionDate: daysAgo(9), completedAt: daysAgo(9) },
    { organizationId: ORG, classroomId: 3, actionType: "bulk_health_screening", description: "Scheduled vision screenings for Dragonflies", recordCount: 8, status: "completed", performedBy: 7, actionDate: daysAgo(5), completedAt: daysAgo(5) },
  ]);

  console.log("Seeding AI insights…");
  await db.insert(aiInsights).values([
    { childId: 7, organizationId: ORG, insightType: "compliance_flag", title: "Attendance pattern alert", content: "Madison Cooper has 4 absences in the last 3 weeks, exceeding the 10% chronic absenteeism threshold. Family services follow-up recommended.", priority: "high", actionRequired: 1, generatedAt: daysAgo(2) },
    { childId: 1, organizationId: ORG, insightType: "health_alert", title: "Dental screening overdue", content: "Isabella Martinez's dental screening expired 12 days ago. Schedule with Sacramento Smiles Dental (previous provider).", priority: "high", actionRequired: 1, generatedAt: daysAgo(3) },
    { childId: 12, organizationId: ORG, insightType: "recommendation", title: "Speech progress trending positive", content: "Zion Jackson's expressive language scores improved 2 levels since speech therapy began. Consider updating ILP goals at next review.", priority: "medium", generatedAt: daysAgo(5) },
    { childId: 8, organizationId: ORG, insightType: "case_summary", title: "Kindergarten transition ready", content: "Mateo Gutierrez meets readiness benchmarks in all DRDP domains. Begin transition paperwork with family.", priority: "low", generatedAt: daysAgo(7) },
  ]);

  console.log("Seeding invoices & payments…");
  await db.insert(invoices).values([
    { organizationId: ORG, familyId: 3, invoiceNumber: "INV-2026-0041", amount: "125.00", dueDate: dateStr(daysAgo(20)), status: "paid", description: "Extended care — October", paidAt: daysAgo(18) },
    { organizationId: ORG, familyId: 7, invoiceNumber: "INV-2026-0042", amount: "125.00", dueDate: dateStr(daysAgo(20)), status: "paid", description: "Extended care — October", paidAt: daysAgo(15) },
    { organizationId: ORG, familyId: 3, invoiceNumber: "INV-2026-0048", amount: "125.00", dueDate: dateStr(daysAhead(10)), status: "sent", description: "Extended care — November" },
    { organizationId: ORG, familyId: 7, invoiceNumber: "INV-2026-0049", amount: "137.50", dueDate: dateStr(daysAhead(10)), status: "sent", description: "Extended care — November (incl. late pickup fee)" },
    { organizationId: ORG, familyId: 10, invoiceNumber: "INV-2026-0050", amount: "125.00", dueDate: dateStr(daysAgo(5)), status: "overdue", description: "Extended care — October" },
    { organizationId: ORG, familyId: 12, invoiceNumber: "INV-2026-0051", amount: "62.50", dueDate: dateStr(daysAhead(15)), status: "draft", description: "Extended care — November (half month)" },
  ]);
  await db.insert(payments).values([
    { invoiceId: 1, organizationId: ORG, amount: "125.00", paymentMethod: "credit_card", status: "completed", transactionDate: daysAgo(18) },
    { invoiceId: 2, organizationId: ORG, amount: "125.00", paymentMethod: "ach", status: "completed", transactionDate: daysAgo(15) },
  ]);

  console.log("Seeding parent portal data…");
  await db.insert(activityLogs).values([
    { childId: 1, staffId: 2, activityType: "meal", description: "Ate all of lunch — chicken, rice, and broccoli", timestamp: at(daysAgo(0), 12, 15) },
    { childId: 1, staffId: 2, activityType: "nap", description: "Napped 12:45–2:10 PM", timestamp: at(daysAgo(0), 14, 10) },
    { childId: 1, staffId: 4, activityType: "activity", description: "Built a tall block tower with friends during free play", timestamp: at(daysAgo(0), 10, 30) },
    { childId: 4, staffId: 8, activityType: "note", description: "Read 'The Very Hungry Caterpillar' aloud to the class!", timestamp: at(daysAgo(0), 11, 0) },
    { childId: 12, staffId: 3, activityType: "meal", description: "Ate most of breakfast — oatmeal and banana", timestamp: at(daysAgo(0), 8, 30) },
  ]);
  await db.insert(parentNotifications).values([
    { familyId: 1, message: "Isabella had a great day! Check her daily activity feed.", type: "activity" },
    { familyId: 1, message: "Reminder: dental screening form due Friday.", type: "alert" },
    { familyId: 3, message: "New photo added to Lily's gallery.", type: "photo", isRead: 1 },
    { familyId: 5, message: "Center closed Friday for staff training.", type: "announcement" },
  ]);

  console.log("Seeding digital documents…");
  await db.insert(digitalDocuments).values([
    { organizationId: ORG, familyId: 1, documentType: "enrollment", documentUrl: "/files/demo/enrollment_packet_2026.pdf", signedBy: "Angela Martinez", signedAt: daysAgo(130), status: "signed" },
    { organizationId: ORG, familyId: 2, documentType: "consent", documentUrl: "/files/demo/photo_consent.pdf", status: "pending", expiresAt: dateStr(daysAhead(14)) },
    { organizationId: ORG, familyId: 4, documentType: "health_form", documentUrl: "/files/demo/health_history_form.pdf", status: "pending", expiresAt: dateStr(daysAhead(7)) },
    { organizationId: ORG, familyId: 6, documentType: "waiver", documentUrl: "/files/demo/field_trip_waiver.pdf", signedBy: "Rosa Gutierrez", signedAt: daysAgo(10), status: "signed" },
    { organizationId: ORG, familyId: 9, documentType: "consent", documentUrl: "/files/demo/screening_consent.pdf", status: "expired", expiresAt: dateStr(daysAgo(5)) },
  ]);

  console.log("Seeding meal plans…");
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  await db.insert(mealPlans).values([
    { organizationId: ORG, classroomId: 1, weekStartDate: dateStr(monday), status: "approved" },
    { organizationId: ORG, classroomId: 2, weekStartDate: dateStr(monday), status: "approved" },
    { organizationId: ORG, classroomId: 3, weekStartDate: dateStr(new Date(monday.getTime() + 7 * 86400000)), status: "draft" },
  ]);
  const menu: Array<["monday" | "tuesday" | "wednesday" | "thursday" | "friday", "breakfast" | "snack" | "lunch" | "afternoon_snack", string]> = [
    ["monday", "breakfast", "Whole grain oatmeal, sliced banana, milk"],
    ["monday", "lunch", "Baked chicken, brown rice, steamed broccoli, milk"],
    ["monday", "afternoon_snack", "Apple slices with sunflower seed butter"],
    ["tuesday", "breakfast", "Scrambled eggs, whole wheat toast, orange wedges, milk"],
    ["tuesday", "lunch", "Turkey & cheese sandwich, carrot sticks, pears, milk"],
    ["tuesday", "afternoon_snack", "Yogurt with granola"],
    ["wednesday", "breakfast", "Whole grain pancakes, mixed berries, milk"],
    ["wednesday", "lunch", "Beef & vegetable stew, cornbread, milk"],
    ["wednesday", "afternoon_snack", "Cheese cubes and whole grain crackers"],
    ["thursday", "breakfast", "Cereal with milk, sliced strawberries"],
    ["thursday", "lunch", "Baked fish, mashed sweet potato, green beans, milk"],
    ["thursday", "afternoon_snack", "Hummus with cucumber slices"],
    ["friday", "breakfast", "Whole wheat bagel with cream cheese, melon, milk"],
    ["friday", "lunch", "Chicken & cheese quesadilla, black beans, salsa, milk"],
    ["friday", "afternoon_snack", "Trail mix (no nuts) and raisins"],
  ];
  await db.insert(mealItems).values([
    ...menu.map(([dayOfWeek, mealType, description]) => ({ mealPlanId: 1, dayOfWeek, mealType, description, servings: 18 })),
    ...menu.map(([dayOfWeek, mealType, description]) => ({ mealPlanId: 2, dayOfWeek, mealType, description, servings: 14 })),
  ]);
  await db.insert(cacfpReports).values([
    { organizationId: ORG, reportMonth: dateStr(new Date(today.getFullYear(), today.getMonth() - 2, 1)), mealsServed: 2140, reimbursementAmount: "7812.40", status: "approved" },
    { organizationId: ORG, reportMonth: dateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1)), mealsServed: 2236, reimbursementAmount: "8164.92", status: "submitted" },
    { organizationId: ORG, reportMonth: dateStr(new Date(today.getFullYear(), today.getMonth(), 1)), mealsServed: 1418, status: "draft" },
  ]);

  console.log("Seeding time clock & certifications…");
  const clockRows: (typeof timeClock.$inferInsert)[] = [];
  for (let d = 0; d < 10; d++) {
    const day = daysAgo(d);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    for (let s = 1; s <= 8; s++) {
      const inT = at(day, 7, 25 + ((s * 7) % 20));
      const outT = at(day, 15, 30 + ((s * 11) % 25));
      clockRows.push({
        staffId: s, clockInTime: inT, clockOutTime: outT,
        hoursWorked: ((outT.getTime() - inT.getTime()) / 3600000).toFixed(2),
        date: dateStr(day),
      });
    }
  }
  // Today: some staff still clocked in
  clockRows.push({ staffId: 2, clockInTime: at(today, 7, 28), date: dateStr(today) });
  clockRows.push({ staffId: 3, clockInTime: at(today, 7, 45), date: dateStr(today) });
  await db.insert(timeClock).values(clockRows);

  await db.insert(certifications).values([
    { staffId: 2, certificationType: "CPR & First Aid", issueDate: dateStr(daysAgo(300)), expiryDate: dateStr(daysAhead(430)), certificationNumber: "CPR-88412", status: "active" },
    { staffId: 3, certificationType: "CPR & First Aid", issueDate: dateStr(daysAgo(700)), expiryDate: dateStr(daysAhead(25)), certificationNumber: "CPR-71203", status: "expiring_soon" },
    { staffId: 2, certificationType: "Child Development Associate (CDA)", issueDate: dateStr(daysAgo(900)), expiryDate: dateStr(daysAhead(195)), certificationNumber: "CDA-2024-5521", status: "active" },
    { staffId: 8, certificationType: "Child Development Associate (CDA)", issueDate: dateStr(daysAgo(1100)), expiryDate: dateStr(daysAgo(10)), certificationNumber: "CDA-2022-1187", status: "expired" },
    { staffId: 7, certificationType: "Pediatric Health Screening", issueDate: dateStr(daysAgo(200)), expiryDate: dateStr(daysAhead(530)), certificationNumber: "PHS-3392", status: "active" },
    { staffId: 4, certificationType: "CPR & First Aid", issueDate: dateStr(daysAgo(100)), expiryDate: dateStr(daysAhead(630)), certificationNumber: "CPR-90518", status: "active" },
  ]);

  console.log("Seeding custom reports…");
  await db.insert(customReports).values([
    { organizationId: ORG, createdByUserId: 1, reportName: "Monthly Attendance Summary", reportType: "attendance", filters: { range: "last_30_days" }, columns: ["child", "daysPresent", "daysAbsent", "rate"], lastRunAt: daysAgo(2) },
    { organizationId: ORG, createdByUserId: 1, reportName: "Health Compliance Status", reportType: "health", filters: { status: ["overdue", "due_soon"] }, columns: ["child", "screening", "status", "expiry"], lastRunAt: daysAgo(5) },
    { organizationId: ORG, createdByUserId: 1, reportName: "Enrollment by Classroom", reportType: "enrollment", filters: {}, columns: ["classroom", "enrolled", "capacity", "utilization"] },
  ]);


  console.log("Seeding family goals & case notes…");
  await db.insert(familyGoals).values([
    { familyId: 1, organizationId: ORG, title: "Enroll in ESL evening classes", description: "Mother wants to improve English for job applications.", category: "education", progress: 40, status: "in_progress", targetDate: daysAhead(90), steps: [{ id: "s1", title: "Collect program options", isCompleted: true, dueDate: null, notes: null }, { id: "s2", title: "Submit application", isCompleted: false, dueDate: dateStr(daysAhead(14)), notes: null }] },
    { familyId: 2, organizationId: ORG, title: "Secure stable housing", description: "Family at risk of losing current rental; pursuing assistance.", category: "housing", progress: 25, status: "in_progress", targetDate: daysAhead(60), steps: [{ id: "s1", title: "Housing Alliance application", isCompleted: true, dueDate: null, notes: "Submitted" }, { id: "s2", title: "Follow up on waitlist", isCompleted: false, dueDate: dateStr(daysAhead(7)), notes: null }] },
    { familyId: 5, organizationId: ORG, title: "Consistent daily attendance", description: "Address transportation barrier affecting Madison's attendance.", category: "attendance", progress: 60, status: "in_progress", targetDate: daysAhead(30), steps: [{ id: "s1", title: "Bus route enrollment", isCompleted: true, dueDate: null, notes: null }, { id: "s2", title: "Two weeks full attendance", isCompleted: false, dueDate: dateStr(daysAhead(14)), notes: null }] },
  ]);

  await db.insert(familyCaseNotes).values([
    { organizationId: ORG, familyId: 1, authorId: 6, type: "home_visit", confidentiality: "standard", body: "Fall home visit completed. Home environment is warm and organized. Mother expressed strong interest in ESL classes — connected her with two evening programs near their apartment. Isabella shows growing vocabulary in both languages.", followUpRequired: 1, followUpDue: daysAhead(18), createdAt: daysAgo(12) },
    { organizationId: ORG, familyId: 1, authorId: 6, type: "phone_call", confidentiality: "standard", body: "Mother called to confirm she picked up the ESL program brochures. She plans to apply to the Tuesday/Thursday program. Asked about childcare during classes — shared Head Start extended-day options.", followUpRequired: 0, createdAt: daysAgo(6) },
    { organizationId: ORG, familyId: 5, authorId: 6, type: "phone_call", confidentiality: "standard", body: "Check-in about Madison's attendance gaps. Grandmother shared that the family car broke down two weeks ago and repairs are unaffordable this month. Shared bus route info and voucher program.", followUpRequired: 1, followUpDue: daysAhead(10), createdAt: daysAgo(3) },
    { organizationId: ORG, familyId: 5, authorId: 2, type: "general", confidentiality: "sensitive", body: "Madison arrived visibly tired two days this week and mentioned the family is staying with relatives temporarily. Monitoring; will raise gently at next family contact. No safety concerns observed.", followUpRequired: 1, followUpDue: daysAhead(5), createdAt: daysAgo(1) },
  ]);

  console.log("Assigning family case loads…");
  // Family advocates for the caseload control tower: staff 6 carries most
  // families, staff 7 a couple, family 6 left unassigned so the supervisor
  // queue has something to triage.
  const advocateAssignments: Array<[number, number]> = [[1, 6], [2, 6], [3, 6], [4, 7], [5, 7]];
  for (const [familyId, advocateId] of advocateAssignments) {
    await db.update(families).set({ familyAdvocateId: advocateId }).where(eq(families.id, familyId));
  }

  console.log("Seeding chat conversations…");
  await db.insert(conversations).values([
    { organizationId: ORG, familyId: 1, createdBy: 1, isActive: 1, staffLastReadAt: at(daysAgo(0), 9), familyLastReadAt: at(daysAgo(0), 8) },
    { organizationId: ORG, familyId: 2, createdBy: 2, isActive: 1, staffLastReadAt: at(daysAgo(1), 15), familyLastReadAt: at(daysAgo(1), 16) },
  ]);
  await db.insert(chatMessages).values([
    { conversationId: 1, senderUserId: 1, senderRole: "staff", body: "Good morning! Just a reminder that Isabella's physical exam is due March 12. Let us know if you need help scheduling.", translations: { __source: "en" }, sentAt: at(daysAgo(2), 9, 15) },
    { conversationId: 1, senderUserId: 3, senderRole: "family", body: "¡Gracias! Ya tenemos la cita con el doctor para el 10 de marzo.", translations: { __source: "es" }, sentAt: at(daysAgo(2), 12, 40) },
    { conversationId: 1, senderUserId: 1, senderRole: "staff", body: "Wonderful — we'll mark it on her record. Isabella had a great day today!", translations: { __source: "en" }, sentAt: at(daysAgo(0), 8, 5) },
    { conversationId: 2, senderUserId: 2, senderRole: "staff", body: "Hi! Sharing this month's family engagement calendar — the science night is next Thursday at 5:30.", translations: { __source: "en" }, sentAt: at(daysAgo(1), 14, 30) },
    { conversationId: 2, senderUserId: 4, senderRole: "family", body: "Cảm ơn cô! Chúng tôi sẽ tham gia.", translations: { __source: "vi" }, sentAt: at(daysAgo(1), 15, 45) },
  ]);

  console.log("✅ Seed complete.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

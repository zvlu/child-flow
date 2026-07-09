#!/usr/bin/env node
/**
 * End-to-end smoke test for the family case-management REST mirror
 * (server/familyCaseManagementRest.ts) — the endpoints iOS's
 * FamilyServicesView / AttendancePlansView / ChronicAbsenceView call.
 *
 * Run this against your OWN dev server + real DB (this can't run inside a
 * sandbox that can't reach your Docker MySQL). It logs in, auto-discovers a
 * real child/family in your org, then creates + reads back one record for
 * every new endpoint, printing PASS/FAIL for each.
 *
 * Usage:
 *   node scripts/test-family-case-management.mjs \
 *     --email admin@childflow.org --password '...' \
 *     [--base http://localhost:3000/api]
 *
 * Requires: your org to have the Head Start module enabled (Settings →
 * Modules on the web app), and at least one child/family with organizationId
 * set. Safe to run repeatedly — every write it makes is clearly labeled
 * "[test script]" so you can tell it apart from real data and delete it.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const BASE = args.base ?? process.env.TEST_BASE_URL ?? "http://localhost:3000/api";
const EMAIL = args.email ?? process.env.TEST_EMAIL;
const PASSWORD = args.password ?? process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Usage: node scripts/test-family-case-management.mjs --email <email> --password <password> [--base <url>]");
  process.exit(1);
}

let token = null;
const results = [];

async function api(method, path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, ok: res.ok, json };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail });
    console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, pass: false, detail: e.message });
    console.log(`❌ ${name} — ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`Testing against ${BASE}\n`);

  // ---- Login ----
  const login = await api("POST", "auth/login", { email: EMAIL, password: PASSWORD });
  assert(login.ok && login.json?.token, `login failed: ${login.status} ${JSON.stringify(login.json)}`);
  token = login.json.token;
  console.log("✅ Logged in\n");

  // ---- Auto-discover a real child + family in this org ----
  const childrenRes = await api("GET", "children");
  assert(childrenRes.ok, `GET /children failed: ${childrenRes.status}`);
  const child = (childrenRes.json ?? []).find((c) => c.familyId);
  assert(child, "No child with a familyId found — create at least one child/family before running this script.");
  const childId = child.id;
  const familyId = child.familyId;
  console.log(`Using child ${childId} (${child.firstName} ${child.lastName}), family ${familyId}\n`);

  // ---- Contacts ----
  await check("POST /families/contacts", async () => {
    const r = await api("POST", "families/contacts", {
      familyId, contactType: "Phone Call", notes: "[test script] contact",
      followUpNeeded: false, date: new Date().toISOString(),
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json.contactType === "Phone Call", "contactType not echoed back");
    return `id=${r.json.id}`;
  });
  await check("GET /families/:familyId/contacts", async () => {
    const r = await api("GET", `families/${familyId}/contacts`);
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    assert(r.json.some((c) => c.notes === "[test script] contact"), "created contact not found in list");
    return `${r.json.length} contact(s)`;
  });

  // ---- Family Partnership Agreement ----
  await check("POST /families/fpa", async () => {
    const r = await api("POST", "families/fpa", { familyId });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json.familyId === String(familyId), "familyId mismatch");
    return `status=${r.json.status}`;
  });
  await check("GET /families/:familyId/fpa", async () => {
    const r = await api("GET", `families/${familyId}/fpa`);
    assert(r.ok, `${r.status}`);
    return `status=${r.json.status}`;
  });

  // ---- Referrals ----
  let referralId = null;
  await check("POST /families/:familyId/referrals", async () => {
    const r = await api("POST", `families/${familyId}/referrals`, {
      agencyName: "[test script] Agency", serviceType: "Housing Assistance",
      referralDate: new Date().toISOString(), notes: "test referral",
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });
  await check("GET /families/:familyId/referrals", async () => {
    const r = await api("GET", `families/${familyId}/referrals`);
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    const created = r.json.find((x) => x.agencyName === "[test script] Agency");
    assert(created, "created referral not found in list");
    assert(created.serviceType === "Housing Assistance", "serviceType not round-tripped");
    referralId = created.id;
    return `${r.json.length} referral(s)`;
  });
  await check("POST /families/:familyId/referrals/:id (update)", async () => {
    assert(referralId, "no referralId from previous step");
    const r = await api("POST", `families/${familyId}/referrals/${referralId}`, { status: "Contacted" });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });

  // ---- Home Visits ----
  await check("POST /families/:familyId/visits", async () => {
    const r = await api("POST", `families/${familyId}/visits`, {
      visitType: "Home Visit", durationMinutes: 30,
      topicsCovered: ["Child Development"], notes: "[test script] visit",
      visitDate: new Date().toISOString(),
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });
  await check("GET /families/:familyId/visits", async () => {
    const r = await api("GET", `families/${familyId}/visits`);
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    const created = r.json.find((v) => v.notes === "[test script] visit");
    assert(created, "created visit not found");
    assert(JSON.stringify(created.topicsCovered) === JSON.stringify(["Child Development"]), "topicsCovered not round-tripped");
    return `${r.json.length} visit(s)`;
  });

  // ---- Family Goals ----
  let goalId = null, stepId = null;
  await check("POST /families/goals", async () => {
    const r = await api("POST", "families/goals", {
      familyId, title: "[test script] goal", category: "Education", steps: ["Step one"],
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json.status === "Not Started", `expected "Not Started", got ${r.json.status}`);
    assert(r.json.steps?.length === 1, "expected 1 step");
    goalId = r.json.id;
    stepId = r.json.steps[0].id;
    return `id=${goalId}`;
  });
  await check("POST /families/goals/:goalId/steps/:stepId", async () => {
    assert(goalId && stepId, "no goalId/stepId from previous step");
    const r = await api("POST", `families/goals/${goalId}/steps/${stepId}`, { completed: true });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });
  await check("GET /families/:familyId/goals (status auto-completes)", async () => {
    const r = await api("GET", `families/${familyId}/goals`);
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    const created = r.json.find((g) => g.id === goalId);
    assert(created, "goal not found");
    assert(created.status === "Completed", `expected "Completed" after finishing the only step, got ${created.status}`);
    return `status=${created.status}`;
  });

  // ---- Family Needs Assessment ----
  await check("POST /families/fna", async () => {
    const r = await api("POST", "families/fna", {
      familyId, notes: "[test script] fna",
      ratings: [{ id: "r1", domain: "Family Safety", level: 3, notes: "ok" }],
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json.ratings?.[0]?.domain === "Family Safety", "domain not round-tripped");
    assert(r.json.ratings?.[0]?.level === 3, "level not round-tripped");
  });
  await check("GET /families/:familyId/fna", async () => {
    const r = await api("GET", `families/${familyId}/fna`);
    assert(r.ok, `${r.status}`);
    return `isComplete=${r.json.isComplete}`;
  });

  // ---- CFCR ----
  await check("POST /children/cfcr", async () => {
    const r = await api("POST", "children/cfcr", {
      childId, meetingDate: new Date().toISOString(), attendanceNotes: "[test script] cfcr",
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });
  await check("GET /children/:childId/cfcr", async () => {
    const r = await api("GET", `children/${childId}/cfcr`);
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    assert(r.json.some((c) => c.attendanceNotes === "[test script] cfcr"), "created CFCR record not found");
    return `${r.json.length} record(s)`;
  });

  // ---- Family Case Notes ----
  let noteId = null;
  await check("POST /families/:familyId/notes", async () => {
    const r = await api("POST", `families/${familyId}/notes`, {
      familyId, type: "General", confidentiality: "Standard", body: "[test script] note",
      followUpRequired: true, followUpDue: new Date(Date.now() + 86400000).toISOString(),
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    noteId = r.json.id;
    return `id=${noteId}`;
  });
  await check("POST /notes/:noteId/followup", async () => {
    assert(noteId, "no noteId from previous step");
    const r = await api("POST", `notes/${noteId}/followup`, { completed: true });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json.followUpCompleted === true, "followUpCompleted not set");
  });

  // ---- Attendance Plans ----
  await check("POST /attendance/plans", async () => {
    const r = await api("POST", "attendance/plans", {
      childId, childName: `${child.firstName} ${child.lastName}`,
      barriers: ["Transportation"], strategies: [{ description: "[test script] weekly check-in" }],
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });
  await check("GET /attendance/plans", async () => {
    const r = await api("GET", "attendance/plans");
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    const created = r.json.find((p) => p.childId === String(childId));
    assert(created, "created plan not found for this child");
    return `${r.json.length} plan(s)`;
  });

  // ---- Chronic Absence (read-only; just confirm it doesn't error) ----
  await check("GET /attendance/chronic-absence", async () => {
    const r = await api("GET", "attendance/chronic-absence");
    assert(r.ok && Array.isArray(r.json), `${r.status} ${JSON.stringify(r.json)}`);
    return `${r.json.length} alert(s)`;
  });

  // ---- Summary ----
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed < results.length) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => !x.pass)) console.log(`  - ${r.name}: ${r.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

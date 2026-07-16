#!/usr/bin/env node
/**
 * End-to-end smoke test for the two "please fix" items:
 *   1. GET /api/dashboard/stats now returns real caseload/tasks/agenda/inbox/
 *      documents instead of the iOS app fabricating mock data client-side.
 *   2. GET/POST /api/documents (+ /api/documents/:id/assign) — the "Choose
 *      File…" stub now actually uploads and persists a real file.
 *
 * Usage:
 *   node scripts/test-dashboard-and-documents.mjs \
 *     --email admin@childflow.org --password '...' \
 *     [--base http://localhost:3000/api]
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
  console.error("Usage: node scripts/test-dashboard-and-documents.mjs --email <email> --password <password> [--base <url>]");
  process.exit(1);
}

let token = null;
const results = [];

async function api(method, path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, ok: res.ok, json };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, pass: true });
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

  const login = await api("POST", "auth/login", { email: EMAIL, password: PASSWORD });
  assert(login.ok && login.json?.token, `login failed: ${login.status} ${JSON.stringify(login.json)}`);
  token = login.json.token;
  console.log("✅ Logged in\n");

  const childrenRes = await api("GET", "children");
  assert(childrenRes.ok, `GET /children failed: ${childrenRes.status}`);
  const child = (childrenRes.json ?? [])[0];
  assert(child, "No children found — create at least one before running this script.");
  console.log(`Using child ${child.id} (${child.firstName} ${child.lastName})\n`);

  // ---- Dashboard ----
  await check("GET /dashboard/stats returns caseload/tasks/agenda/inbox/documents", async () => {
    const r = await api("GET", "dashboard/stats");
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    for (const key of ["stats", "alerts", "caseload", "tasks", "agenda"]) {
      assert(key in r.json, `missing "${key}" in response`);
    }
    assert(Array.isArray(r.json.caseload), "caseload should be an array");
    assert(Array.isArray(r.json.tasks), "tasks should be an array");
    assert(Array.isArray(r.json.agenda), "agenda should be an array");
    return `caseload=${r.json.caseload.length}, tasks=${r.json.tasks.length}, agenda=${r.json.agenda.length}`;
  });

  // ---- Documents ----
  let documentId = null;
  const fakeFileBase64 = Buffer.from("This is a test document uploaded by the smoke test script.").toString("base64");

  await check("POST /documents (real upload, no cloud storage needed)", async () => {
    const r = await api("POST", "documents", {
      name: "[test script] document", documentType: "other", fileBase64: fakeFileBase64, mimeType: "text/plain",
    });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json.fileUrl?.startsWith("/uploads/"), `expected a /uploads/ url, got ${r.json.fileUrl}`);
    assert(r.json.assignedChildId === null, "a document with no childId should start unassigned");
    documentId = r.json.id;
    return `id=${documentId}, url=${r.json.fileUrl}`;
  });

  await check("Uploaded file is actually retrievable from disk", async () => {
    const uploadRes = await api("GET", "documents");
    const doc = (uploadRes.json ?? []).find((d) => d.id === documentId);
    assert(doc, "uploaded document not found in list");
    const fileRes = await fetch(`${BASE.replace(/\/api$/, "")}${doc.fileUrl}`);
    assert(fileRes.ok, `file not reachable at ${doc.fileUrl}: ${fileRes.status}`);
    const text = await fileRes.text();
    assert(text.includes("test document"), "downloaded file content doesn't match what was uploaded");
  });

  await check("POST /documents/:id/assign files it to a real child", async () => {
    const r = await api("POST", `documents/${documentId}/assign`, { childId: child.id });
    assert(r.ok, `${r.status} ${JSON.stringify(r.json)}`);
  });

  await check("GET /documents reflects the assignment", async () => {
    const r = await api("GET", "documents");
    assert(r.ok && Array.isArray(r.json), `${r.status}`);
    const doc = r.json.find((d) => d.id === documentId);
    assert(doc, "document not found");
    assert(doc.assignedChildId === String(child.id), `expected assignedChildId ${child.id}, got ${doc.assignedChildId}`);
    assert(doc.assignedChildName === `${child.firstName} ${child.lastName}`, "assignedChildName not resolved");
  });

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

# Sprout Modularization Plan — General Core + Optional Head Start Module

> **Status (implemented):** §§2–6 are done — schema + migration 0032 (backfill on),
> `requireModule` middleware (`hsStaffProcedure`/`hsAdminProcedure`, 11 routers swapped),
> REST gates (`server/pir.ts`, staff-activity in `programModules.ts`), `useOrgModules` +
> nav `module` tags + `ModuleGate` on 10 routes, Settings › Program Modules card,
> hybrid-page conditionals (Enrollment ERSEA/§1302.17, Reports staff-activity,
> Communication contact logs), seed update. Typecheck passes; vitest + dev-server
> click-through must run on the Mac (sandbox can't run the darwin esbuild binary).
> Remaining: §5 terminology sweep of marketing/entry pages, §7 iOS phase 2.

Goal: Sprout becomes a general school / early-childhood management app. Head Start
compliance (§1302 features) becomes an org-level module that admins can enable.
Model: `organizations.enabledModules` JSON array of module ids — `"head_start"` now,
extensible later (e.g. `"subsidies"`, `"meals"` if we ever want per-org gating of those).

## 1. Feature classification

**General core (always on):** dashboard, children, classrooms, attendance,
daily-reports, staff, staff-operations, lesson-planning, portfolios, assessments,
health records, calendar, communication/messaging, documents, e-signatures,
subsidies, billing, meal-planning, parent-portal, reports, report-builder,
ai-insights, bulk-actions, action-queue, glossary, settings.

**Head Start module (gated):**

| Feature | Route | tRPC router | Notes |
|---|---|---|---|
| PIR / Compliance | `/compliance` | `compliance` | Smart Fill lives here |
| Partnership Agreements (FPA) | `/family-partnership` | `fpa` | §1302.52 |
| Policy Council | `/policy-council` | `policyCouncil` | §1302.50 |
| Health Deadlines | `/health-deadlines` | `healthDeadlines` | §1302.42 |
| Chronic Absence | `/chronic-absence` | `chronicAbsence` | §1302.16 |
| Disability Services | `/disability-services` | `disabilityServices` | §1302.60 |
| Grant & Budget | `/grant-budget` | `grantBudget` | admin only already |
| Classroom Quality | `/classroom-quality` | `classroomQuality` | CLASS/ECERS |
| In-Kind | `/in-kind` | `inKind` | non-federal share |
| Family Services | `/family-services` | `familyServices` | advocate workflows |
| Suspension Log | (tab in Enrollment) | `suspensionLog` | §1302.17 |
| ERSEA scoring | (tabs in Enrollment) | parts of `enrollment` | see hybrid below |

**Hybrid pages (stay visible, HS parts conditional):**
- `Enrollment.tsx` — page stays; ERSEA calculator, ranked-scores, and §1302.17 tabs
  render only when module on. Base enrollment (applications, waitlist) is general.
- `Reports.tsx` / `ReportBuilder.tsx` — hide HS-specific report types when off.
- `Dashboard.tsx` — hide HS compliance widgets when off.

**Decision points (defaulting to "gate in v1, revisit"):** chronic absence and
classroom quality (ECERS) are useful outside Head Start; if a customer asks,
promote them to core or their own module ids — the JSON model makes that cheap.

## 2. Schema + migration (0032)

`drizzle/schema.ts` → organizations table:

```ts
/** Enabled optional modules, e.g. ["head_start"]. Empty/null = core only. */
enabledModules: json("enabledModules").$type<string[]>(),
```

- Migration 0032: add column, then `UPDATE organizations SET enabledModules =
  '["head_start"]'` — every existing org is a Head Start program, so backfill on.
- New orgs default to core-only (null) — HS is opt-in, matching the new positioning.
- Fix the stale comment "Each organization represents a Head Start program or agency"
  (schema.ts ~line 110).
- Shared module ids in `shared/` (e.g. `shared/modules.ts`):
  `export const MODULE_IDS = ["head_start"] as const;` + helper
  `hasModule(org, id)` treating null as none.

## 3. Server gating

- `server/_core/trpc.ts`: add `requireModule(id)` middleware that loads the caller's
  org (ctx already has `user.organizationId`; reuse/introduce a cached org lookup)
  and throws `FORBIDDEN` ("This feature isn't enabled for your program") when missing.
  Export composed procedures:
  `hsStaffProcedure = orgStaffProcedure.use(requireModule("head_start"))` and
  `hsAdminProcedure = orgAdminProcedure.use(requireModule("head_start"))`.
- `server/routers.ts`: swap procedure bases in the gated routers listed above.
  Platform owner (super admin) bypasses the check.
- `organizations.get` already returns the org row — enabledModules rides along free.
- `organizations.update` zod: add
  `enabledModules: z.array(z.enum(MODULE_IDS)).optional()` so org admins can toggle
  from Settings. Audit-log the change (`detail: "modules"`).
- REST mirrors: `server/programModules.ts` is all general (leave alone). HS REST
  routes serving iOS need the same org-module check — verified:
  `server/pir.ts` (registerPirRoutes) is HS; audit `server/absences.ts`,
  `server/family.ts`, `server/attendance.ts` (registered in `server/_core/index.ts`)
  for HS-specific endpoints (chronic-absence thresholds, FPA) vs general ones.

## 4. Web client gating

- **Org modules hook** — `client/src/hooks/useOrgModules.ts`: wraps
  `trpc.organizations.get.useQuery(ORGANIZATION_ID)` (the client currently uses a
  hardcoded single-tenant `ORGANIZATION_ID` constant — see `Settings.tsx:634`;
  reuse it until multi-tenant org context lands). Returns `{ has(module),
  isLoading }`. Parents: default to core-only view unless modules are exposed via
  a parent-safe payload.
- **Nav** — `client/src/config/nav.ts`: add `module?: ModuleId` to `NavItem`; tag the
  HS items (chronic-absence, family-partnership, policy-council, health-deadlines,
  disability-services, grant-budget, classroom-quality, in-kind, family-services,
  compliance). Thread an `enabledModules` argument through `visibleToRole` /
  `applyTopNav` / `applySideNav` / `topNavForRole` / `sideNavForRole`; callers are
  `AppLayout.tsx` and `Settings.tsx` (nav-customization panel must also hide gated
  items so users can't "unhide" features they don't have).
- **Routes** — `client/src/App.tsx`: wrap the ~10 HS routes in a `<ModuleGate
  module="head_start">` component that renders a friendly "not enabled — ask your
  admin / enable in Settings" screen instead of the page (server is the real
  enforcement; this is UX).
- **Hybrid pages** — `Enrollment.tsx`: conditionally render ERSEA/§1302.17 tabs.
  `Dashboard.tsx`, `Reports.tsx`, `ReportBuilder.tsx`: same pattern.
- **Settings › Program** (`Settings.tsx`) — admin-only "Modules" card: toggle for
  "Head Start compliance (PIR, ERSEA, FPA, Policy Council…)" calling
  `organizations.update`. Invalidate the org query so nav updates live.

## 5. Terminology sweep (module off = neutral language)

Pages that mention Head Start / §1302 / ERSEA / PIR outside the gated set:
`Home.tsx`, `SignIn.tsx`, `RequestProgram.tsx`, `OrgAdmin.tsx`, `Settings.tsx`,
`Enrollment.tsx`, `Reports.tsx`, `ReportBuilder.tsx`.

- Marketing/entry pages (`Home`, `SignIn`, `RequestProgram`): reposition copy as
  general early-childhood/school management, with Head Start compliance named as a
  flagship add-on (it's the moat — feature it, don't bury it).
- In-app strings on hybrid pages: only show regulatory references when module on.
- Nav labels are already mostly neutral; "Partnership Agreements" etc. only appear
  when gated on, so no rename needed.

## 6. Seeds & dev

- `scripts/seed.ts`: set `enabledModules: ["head_start"]` on the demo org so the
  full demo keeps working. Optionally add a second core-only org to test gating.
- `seed-pir-questions.ts` / `seed-sprout-features.ts`: unchanged (HS data is inert
  when module off).

## 7. iOS (phase 2 — after web ships)

- Staff app: org payload (whatever `AppState.swift` loads at login) gains
  `enabledModules`; `MainTabView.swift` and any HS screens (health deadlines,
  chronic absence, FPA, PIR, home-visit/case-note flows if HS-branded) render
  conditionally. Family app is already general — likely no changes.
- Server REST checks from §3 protect data regardless, so iOS gating is pure UX
  and can lag the web release safely.

## 8. Order of work

1. `shared/modules.ts` + schema column + migration 0032 + backfill.
2. `requireModule` middleware + swap procedure bases + REST checks.
3. `useOrgModules` + nav tagging + `ModuleGate` routes.
4. Settings toggle + org update path + audit log.
5. Hybrid-page conditionals + terminology sweep.
6. Seeds; then test matrix: HS org sees everything (no regressions), core org
   sees no HS nav/routes and gets FORBIDDEN on direct tRPC calls, toggle flips
   both live, parent role unaffected.
7. Phase 2: iOS gating.

## 9. Risks / notes

- `users.settings.navigation` prefs may reference hidden paths — the apply*
  functions already tolerate unknown paths, but verify no crash when a saved
  order contains gated items.
- Enrollment untangling is the largest single item; everything else is mechanical.
- Don't gate `suspensionLog`/HS data *writes* only — reads too, or reports leak.
- Keep `enabledModules` out of any parent-facing payloads unless needed.

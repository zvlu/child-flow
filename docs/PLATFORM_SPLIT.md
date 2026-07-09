# Platform Split — What Lives on Mobile vs Web

Decision (July 2026): don't chase 100% feature parity. Field work goes on the
iOS staff app; desk work stays web-only. This matches the product category
(Brightwheel, Procare do the same) and keeps mobile effort focused.

## Mobile (iOS staff app) — field work

Work done standing up, in a classroom, or in a family's home:

attendance & chronic absence, daily reports, health records/deadlines/compliance,
family services (FNA, CFCR, contacts, home visits, case notes), lesson planning,
portfolios, assessments, messaging, enrollment applications & ERSEA, meals,
subsidies, documents, **e-signatures (added — see below)**, PIR review, calendar,
staff activity.

**Disability services (IEP/IFSP) — added (see below).**

Good future candidates (field-flavored, currently web-only):
- **Classroom quality (CLASS/ECERS)** — observations are done in the room.
- **Policy council** — attendance + minutes capture during meetings.

## Web only — desk work

Grant & budget, billing/invoicing, report builder, bulk actions, AI insights,
org admin & plan management, policy council administration, in-kind ledger,
performance panel. These are admin tools used at a desk; no mobile plans.

## The recipe for adding a feature to mobile

1. REST mirror in `server/programModules.ts` (or a feature file) wrapping the
   same `server/moduleDb.ts` functions the web tRPC router uses. Head Start
   features must check `userHasModule(user, "head_start")` (`server/_core/modules.ts`).
2. Swift model in `ios/Sources/Models/Models.swift` + methods in
   `ios/Sources/Networking/APIClient.swift`.
3. SwiftUI views (list → detail), mock fallback in `ios/Sources/App/MockData.swift`
   so demo mode works, entry point in `MainTabView` menu, and — if tasks/alerts
   should deep-link — a `TaskDestination` case + launch view in
   `ios/Sources/Dashboard/DashboardView.swift`.
4. New Swift files ⇒ `cd ios && xcodegen generate`, then build in Xcode.

## E-Signatures (implemented as the template for this recipe)

- Server: `GET/POST /api/digital-documents`, `POST /api/digital-documents/:id/sign`
  (audit-logged, org-scoped, blocks re-signing/expired). `documentType` gained `"iep"`
  (migration 0033); web zod updated to match.
- iOS: `DigitalDocumentsView` (list, in More menu under Communication),
  `DocumentSignView` (WKWebView render + typed-name signature with confirm),
  `DocumentSignLaunchView` (deep link by family + type). Dashboard task
  "Sign Sofia Johnson's IEP" → `.documentSign(familyName: "Johnson", documentType: "iep")`.
- Signature is typed-name (matches `digitalDocuments.signedBy`). A drawn-signature
  canvas would need a `signatureDataUrl` column + upload; deferred.

## Disability Services / IEP-IFSP (implemented)

- Server: `GET /api/disability-services`, `POST /api/disability-services`,
  `POST /api/disability-services/:id/parent-rights`,
  `POST /api/disability-services/:id/transition` in `server/programModules.ts`,
  wrapping `server/disabilityServices.ts` — same summary/upsert/parent-rights/
  transition-checklist logic as the web `disabilityServices` tRPC router.
  Head Start-gated (`userHasModule`). Added `disabilityService` to
  `ORG_RECORD_TABLES` in `server/moduleDb.ts` for the tenancy check.
- iOS: `DisabilityServicesView` (summary card + plan list, in Families menu —
  gated by `appState.hasModule(.headStart)`), `DisabilityRecordDetailView`
  (plan/LEA info, parent-rights-notification sheet, transition checklist).

## iOS module gating (phase 2, implemented)

- `/api/auth/me` now returns `enabledModules` (the caller's org's enabled
  modules) alongside role — `server/_core/auth.ts`.
- `User.enabledModules` on iOS; `AppState.hasModule(_:)` reads it.
- `MainTabView`'s hamburger menu conditionally shows Family Services, Chronic
  Absence, Disability Services, Attendance Plans, Compliance (PIR), and Staff
  Activity only when Head Start is enabled. Presentation only — the REST/tRPC
  layer enforces access independently either way.

## Mock-data gap (found while wiring gating, now fixed)

Auditing which REST endpoints the HS-gated iOS screens actually call had
turned up missing server routes: `AttendancePlansView`/`ChronicAbsenceView`
called `/api/attendance/plans` and `/api/attendance/chronic-absence`, and
`FamilyServicesView`'s FNA/CFCR/goals/case-notes/referrals/contacts/visit-log
calls (`getFNA`, `getCFCRRecords`, `getGoals`, etc.) had no corresponding
Express routes at all — these screens only ever showed DEBUG mock data.

Fixed with full iOS+web parity:

- **Schema** (migration `0034_family_services_extensions.sql`): new tables
  `family_goals` (status enum widened + `organizationId` backfilled),
  `family_referrals`, `family_home_visits`, `family_needs_assessments`,
  `cfcr_records`, `family_case_notes`, `attendance_plans`.
- **Data access**: `server/familyCaseManagement.ts` (goals, referrals, home
  visits, contacts, FNA, CFCR, case notes + tenancy helpers) and
  `server/attendancePlans.ts` (AIP CRUD), reused by both layers below.
- **Web (tRPC)**: `familyGoals`, `familyReferrals`, `familyHomeVisits`, `fna`,
  `cfcr`, `familyCaseNotes`, `attendancePlans` routers in `server/routers.ts`,
  all Head Start-gated (`hsStaffProcedure`).
- **iOS (REST)**: `server/familyCaseManagementRest.ts`, registered in
  `server/_core/index.ts`, mirrors the exact paths `APIClient.swift` already
  called (contacts, FPA, referrals, home visits, goals, FNA, CFCR, case notes)
  plus `/api/attendance/plans` and `/api/attendance/chronic-absence`
  (wrapping `server/chronicAbsence.ts`, remapping field names to
  `ChronicAbsenceAlert`'s shape — `hasAIP`/`lastOutreachDate`/
  `consecutiveAbsences`/`notes` are best-effort since the DB has no exact
  backing data for them yet). All gated by `userHasModule(user, "head_start")`
  and org/tenancy-checked.
- Every response shape was cross-checked field-by-field against the iOS
  `Codable` structs in `Models.swift` (enum raw-value strings, `Date` vs ISO
  string, optional vs non-optional). One real bug caught this way: `saveFNA`
  posts to `families/fna` (familyId in the body), not
  `families/:familyId/fna` — fixed to match.
- Known deferred edge case: `AttendancePlansView`'s manual "New Plan" form and
  `FamilyPartnershipView`'s "Add Referral" flow generate a client-side
  `UUID().uuidString` in place of a real numeric id. The attendance-plan
  create endpoint falls back to matching on `childName` within the org; the
  referral endpoints do not (creating a referral returns no id, so
  `updateReferral` on a not-yet-refetched referral will 404 until the list is
  reloaded from the server). Not fixed further — deliberately out of scope for
  this pass.

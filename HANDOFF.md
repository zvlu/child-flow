# Sprout — Session Handoff (July 2026)

State of the world after the big build session. Read this first in a new session.

## July 10 session (10 commits on feature/ios-app)

All web unless noted; tsc-clean, 46/46 vitest, vite build passing at every commit.

| Feature | Where | Notes |
|---------|-------|-------|
| Data Import (one-upload roster migration) | `/data-import`, `server/dataImport.ts` | Children + deduped families (siblings auto-link) + health records from one CSV; template download, alias column matching, per-row validation. Unit tested. |
| Onboarding checklist | Dashboard, `components/OnboardingChecklist.tsx` | 5 live-detected setup steps; dismissible (localStorage). |
| Unified action feed | `hooks/useActionItems.ts` | Health + AI insights + documents + credentials + chronic absence; shared by Action Queue and the dashboard "Needs Attention Today" card. |
| Web family chat | Communication → Family Chat tab, `components/FamilyChat.tsx` | Same REST endpoints as iOS; translation w/ show-original, unread badges, read receipts, 5s polling. |
| AI case summaries (true LLM) | Family Services → AI Summary; `familyCaseNotes.summarize` | Structured output: summary, themes, goal links. Supersedes the "template engine" note in deferred items. |
| Chronic-absence alerts + staff push | `server/absenceAlerts.ts`, hooked into `attendance.save` | Compliance-flag insight (dedupes via undismissed flag) + one batched APNs push to org staff. |
| Empty-patch guards | `server/_core/patch.ts` | Applied to all nine all-optional update helpers; closes the drizzle "No values to set" item below. |
| Global record search | Cmd+K palette | Live children/families results; `/family-services?family=<id>` deep link. |
| Chat language setting | Settings → Notifications | `users.settings.preferredLanguage` settable on web (was iOS-only). |
| ERSEA verification checklist | Enrollment → Verification tab | Web parity with iOS Application Verification; same REST + JSON shapes, syncs mid-checklist. |
| Audit Readiness Score | Compliance (full) + Dashboard (compact); `server/auditReadiness.ts` | Weighted live score across §1302.42/.16/.52/.12–.14/.91 + PIR. Unit tested. |
| Review Binder export | Compliance → Export Review Binder | Print-ready evidence package: readiness, roster, ADA, health deadlines, FPAs, credentials. |
| Kiosk check-in | `/kiosk` (chromeless route); button on Attendance | New `attendance.mark` single-child upsert — the old `attendance.save` REPLACES the whole day; never call it from kiosks. |
| Recurring tuition + AR aging | Billing page; `server/billingPlans.ts` | **NEW TABLE `billing_plans` — run `pnpm db:push`.** Idempotent invoice generation with catch-up; aging buckets. Unit tested. |
| Seed data | `scripts/seed.ts` | Now also seeds family goals, case notes (rich enough for AI summary), translated chat threads + 2 parent users. |

Also: credential expiry flags and breadcrumbs listed as "not built" below turned
out to already exist — those notes are stale, not the features.

## What's built (competitive roadmap: 13/13 complete)

| # | Feature | iOS | Web | Where |
|---|---------|-----|-----|-------|
| 1 | PIR Auto-Population | ✅ Smart Fill | ✅ Smart Fill dialog | Compliance page → Smart Fill button |
| 2 | FPA Builder (§1302.52) | ✅ | ✅ | `/family-partnership` |
| 3 | ERSEA Engine (§1302.12/.14/.17) | ✅ | ✅ | Enrollment: calculator, ranked scores, §1302.17 tab |
| 4 | Health Deadlines (§1302.42) | ✅ | ✅ | `/health-deadlines` |
| 5 | Chronic Absence (§1302.16) | ✅ | ✅ | `/chronic-absence` |
| 6 | Real-time message translation | ✅ | server-side | `server/translation.ts`, stamps + cache in `chat_messages.translations` |
| 7 | Home Visit Mode | ✅ | n/a | iOS staff app |
| 8 | AI Case Note Assistant | ✅ | n/a | iOS staff app (template engine, not true LLM yet) |
| 9 | Policy Council (§1302.50) | — | ✅ | `/policy-council` |
| 10 | Staff credentials | partial | partial | certifications table exists; no expiry auto-flags yet |
| 11 | IEP/IFSP Hub (§1302.60) | — | ✅ | `/disability-services` |
| 12 | Grant & Budget | — | ✅ | `/grant-budget` (admin only) |
| 13 | CLASS/ECERS | — | ✅ | `/classroom-quality` |

Multilingual family app: 6 languages (en/es/ht/zh-Hans/vi/ar), live switching,
RTL for Arabic — `ios/FamilySources/App/FamilyL10n.swift`.

## Running locally

```bash
./dev.sh                     # Docker MySQL on host port 3307 + migrations + dev server
# app: http://localhost:3000 — any email logs in (ALLOW_DEV_AUTH_BYPASS)
```

Seed order (base seed truncates everything, so always this order):
```bash
npx tsx scripts/seed.ts
npx tsx scripts/seed-pir-questions.ts
npx tsx scripts/seed-sprout-features.ts
```

iOS: the checked-in .xcodeproj is GENERATED from `ios/project.yml`.
After adding/removing Swift files: `brew install xcodegen && cd ios && xcodegen generate`.
Targets: Sprout (staff), SproutFamily (parents). No Swift toolchain in the
Cowork sandbox — builds must happen in Xcode on the Mac.

## Architecture notes

- Web: React/Vite + wouter + shadcn + tRPC (superjson) + Drizzle/MySQL.
  New feature routers in `server/routers.ts`; queries in per-feature files
  (`server/chronicAbsence.ts`, `fpaDb.ts`, `healthDeadlines.ts`,
  `pirAutoPopulate.ts`, `suspensionLog.ts`, `policyCouncil.ts`,
  `disabilityServices.ts`, `grantBudget.ts`, `classroomQuality.ts`,
  `translation.ts`).
- Org scoping: `orgStaffProcedure`/`orgAdminProcedure` + explicit tenancy
  checks on child/classroom/family FKs in every new write path (added after
  adversarial review — keep doing this for new features).
- Message translation: sender language stamped in
  `chat_messages.translations.__source`; per-language cache in same JSON;
  viewer preference in `users.settings.preferredLanguage`
  (`POST /api/messaging/language`). LLM via `server/_core/llm.ts` (Gemini).
- PIR: values locked once report status != draft (enforced in
  `moduleDb.upsertPirValue`).
- Migrations 0025–0031 are the new tables. `db:push` = generate + migrate.

## Known deferred items

- iOS staff app has NOT been compiled since the new files were added —
  needs `xcodegen generate` + Xcode build; expect minor fixes.
- ~~Case note assistant is template-based~~ → done July 10 (web `familyCaseNotes.summarize`); iOS still uses the template engine, could call the new route.
- ~~Staff credential expiry auto-flags~~ → was already built (live status in Action Queue / Staff Ops); note was stale.
- ~~Empty-patch mutations throw drizzle "No values to set"~~ → guarded July 10 (`server/_core/patch.ts`).
- ~~Web Communication is broadcast-only~~ → Family Chat tab added July 10.
- Online payments (Stripe/ACH) not started — needs merchant onboarding + API keys, deliberate decision.
- Invoice auto-generation is button-triggered; no server cron yet (route `billing.generateInvoices` is idempotent and cron-safe).
- Kiosk has no PIN lock — anyone at the tablet can check any child in/out. Fine for staff-operated drop-off; add a per-family PIN before parent-operated use.
- `NEXT_PUBLIC_SITE_URL` (landing repo) and APNs/Gemini env vars unset in production.

## Suggested next steps

1. Push feature/ios-app (10 commits), `pnpm db:push` (billing_plans), re-seed, click through the demo.
2. Build both iOS targets in Xcode; fix compile fallout.
3. Put the demo in front of a real Head Start director; their notes > more features.
4. Validate Audit Readiness weights/thresholds with that director (they're first-pass readings of the standards).
5. Stripe checkout for invoices when ready to take payments.
6. Point iOS case-note assistant at the new `familyCaseNotes.summarize` route.

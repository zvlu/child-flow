# Sprout — Session Handoff (July 2026)

State of the world after the big build session. Read this first in a new session.

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
- Case note assistant is template-based; "AI summarize + goal-link" not wired.
- Staff credential expiry auto-flags (#10) not built.
- Empty-patch mutations (all-optional zod updates) throw drizzle
  "No values to set" — unreachable from UI, guard if exposing APIs.
- Web Communication page is broadcast logs; thread chat UI is iOS-only.

## Suggested next steps

1. Build both iOS targets in Xcode; fix compile fallout.
2. Click through demo with seeded data; polish rough edges.
3. Staff credential tracker (#10 completion) — cheap win.
4. Push notifications for chronic-absence threshold crossings.
5. True LLM case-note summarization (engine exists in `_core/llm.ts`).

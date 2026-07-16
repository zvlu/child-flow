# Head Start Program Information Report (PIR) — reference

Reference for building PIR reporting into Sprout/ChildFlow. The machine-readable
field catalog lives in [`pir-catalog.json`](./pir-catalog.json).

## What the PIR is

The **Program Information Report (PIR)** is the federal annual report every Head Start
and Early Head Start grantee submits to the Office of Head Start. It is a major source
of data for Congressional/public inquiries and research. It is collected under
**OMB control number 0970-0427**, which actually covers three instruments:

1. **PIR** — annual, the big one (~2.25 responses per respondent/year).
2. **Monthly Enrollment** — monthly, includes the waiting-list count.
3. **Center Locations and Contacts** — helps parents locate programs.

Reported federal burden: ~1,600 respondents, ~11,760 total annual hours across all three.

> The ChildPlus help page you linked (`app.childplus.com/.../PIR Resources.htm`) is
> **login-gated** — it just wraps this same federal form in their UI. The authoritative
> content is the federal form itself, sourced below.

## The four reporting sections

| # | Section | Covers |
|---|---------|--------|
| A | **Program Information** | Enrollment, funded vs. cumulative, attendance, eligibility categories, age, race/ethnicity, language, turnover |
| B | **Program Staff and Qualifications** | Staff & volunteer counts, teacher/home-visitor credentials (CDA/AA/BA/advanced), managers, turnover |
| C | **Child and Family Services** | Health (insurance, medical/dental home, EPSDT, immunizations, BMI), mental health, disabilities/IEP-IFSP, education, family demographics, family services, homelessness, engagement |
| D | **Grant Level Questions** | Grant/funding, facilities, sessions, CACFP, waiting list |

## 2025 changes (confirmed via Federal Register)

- **New:** primary reasons children with an IEP/IFSP did **not** receive services.
- **New:** number of children who had a **504 Plan**.
- **New (Monthly Enrollment):** total children (and EHS pregnant women) on the
  **waiting list** on the last operating day of the month.

## Authoritative sources

- Official PIR landing page: https://headstart.gov/program-data/article/program-information-report-pir
- 2025 Federal Register notice (sections + changes + burden): https://www.govinfo.gov/content/pkg/FR-2025-09-17/html/2025-18012.htm
- OMB ICR (form documents, latest): https://omb.report/icr/202501-0970-008
- Full PIR form 2023–2024 (every question, verbatim): https://omb.report/icr/202306-0970-001/doc/132446901

## ⚠️ Accuracy boundary — read before building

The catalog's **section taxonomy and field categories are confirmed** against the
federal sources above. But:

- **Field codes** (`program_information.enrollment.funded_enrollment`) are **app-internal
  slugs, not official OMB question numbers.** Backfill the real `A.x`/`C.x` numbers from the form PDF.
- **Exact wording, response buckets, and the complete ~600-field set** are revised each
  program year. This catalog covers the **core/well-known fields**, not literally every line.
- Before treating this as authoritative, **reconcile against the current official PIR form PDF**
  (the omb.report "full form" link above). Those host PDFs block automated fetching, so a
  human download + diff is the last mile.

## Suggested data model (matches your Drizzle + MySQL, org-scoped stack)

```
pir_reports        — one row per (organizationId, programYear). Status: draft|submitted.
pir_field_values   — one row per (reportId, fieldCode, value). The catalog seeds fieldCode.
```

Notes for the schema:
- Org-scope `pir_reports.organizationId` with `.notNull().references(() => organizations.id)`
  to match the tenant-isolation pattern already enforced elsewhere in `drizzle/schema.ts`.
- Most fields are integer counts; a few are derived percentages; a handful are enum/boolean/text.
- **Paired fields**: several health items are reported twice — "at enrollment" vs. "at end of
  year". In the catalog these are two field codes (`*_enrollment` / `*_eoy`) sharing one concept.
  Model them as two values, not two questions.
- Seed the question catalog from `pir-catalog.json` so the field list is data, not code —
  next year's form changes become a JSON edit, not a migration.

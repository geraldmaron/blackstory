# feat/theme-impact-gap-ingest — parallel lane plan

## Data page visualization lane (repo-q42a)

**Shipped:** Rethought `/data` around five Phase 1 / theme-impact chart compositions:

1. **Wealth gap** — SCF median net worth (Black vs White, nation) → `/themes/redlining` Q3
2. **Cook homeownership** — NHGIS decennial tenure by race (1990–2010) → redlining Q3
3. **HMDA denial rates** — Cook County Black vs White (2022–2023) → redlining Q3
4. **CHAS cost burden** — suburban Cook Black vs White (Table 20) → redlining Q4
5. **Justice pair** — BJS MD imprisonment juxtaposition + USSC crack vs powder sentences → `/themes/drug_policy_state` Q6

**Domain:** `packages/domain/src/statistics/data-page-series.ts` — fixture bundle + observation merge helpers shared with Themes metric ids.

**Web:** `apps/web/src/lib/demographics/data-page-indicators.ts` reads `bb_reference.statistical_observations` or `dataPageIndicatorSeries` snapshot, else fixtures.

**Removed from primary nav:** empty ACS / hate crime / Opportunity Atlas coverage sections (sparse without warehouse).

## Themes page lane (other agent)

Do not edit `apps/web/src/app/themes/**`. Cross-links from `/data` point to `/themes/redlining` and `/themes/drug_policy_state`.

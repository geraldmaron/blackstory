<!--
  Research run identifying authoritative sources to fill confirmed theme-impact
  data gaps. Registration / recommendation is not approval to ingest or publish.
-->

# Theme-impact gap-fill source research

**Status:** Research complete (2026-07-22) — **no ingest in this run**  
**Bead:** theme-impact gap-fill source research  
**Companions:** [context-data-source-matrix.md](./context-data-source-matrix.md), [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md), [chicago-pilot-hmda-wealth-defer.md](./chicago-pilot-hmda-wealth-defer.md), `packages/domain/src/external-data-sources.ts`

## 1. Method

1. Inventory `bb_reference.statistical_observations` metric coverage and packet `gap_states`.
2. Cross-check registered / proposed sources in `EXTERNAL_DATA_SOURCES` and the context matrix.
3. External research for custodians, access URLs, years, geography, and rights posture.
4. Rank fills by packet impact (Q3–Q9) and feasibility (API / PD / attribution / gated).

**Explicit non-actions this run:** no scrapes, no registry enablement, no Supabase inserts, no Mapping Inequality GeoJSON re-download.

## 2. Warehouse reality (what we have today)

| Metric family | Rows (approx.) | Periods present | Packet use |
|---------------|----------------|-----------------|------------|
| ACS race-sliced county | ~6.2k | mostly **2020–2024** (some **2018–2022**) | Redlining Q3–Q4 |
| Vera jail rate (county) | 3,052 | **1970–2024** nationally, but Cook `17031` has **only 2024** | Drug Q6 (single year) |
| Eviction Lab county filings | 821 | **2000–2018** | Loaded for a **subset of counties** (IL/Cook `17031` = **0 rows**) — not yet usable for Chicago packets |
| BJS `imprisonment-rate-*-state` | 102 | **2022–2023** | **QA hold** — values look like counts, not per_100k |
| SCF / SIPP wealth | 3 | **2021–2022** national snapshots | Drug Q6; deferred on metro Q3 |
| HMDA aggregates | **0** | — | Explicit Chicago defer |
| HOLC polygons | 10,154 areas | ~**1935–1940** (cite-only public) | Redlining Q1–Q2 artifacts |

## 3. Confirmed gaps → recommended sources

Priority: **P0** unblocks published packets; **P1** deepens eras; **P2** opens next themes.

### P0 — Fix or fill what packets already claim

| Gap | Questions | Recommended source | Access | Years / geo | Strategy | Rights | Fill action |
|-----|-----------|--------------------|--------|-------------|----------|--------|-------------|
| BJS rate unit QA (`repo-bba2`) | Q6, Q8 | **BJS NPS published tables + ICPSR 38871** (`bjs-national-prisoner-statistics`) | [NPS](https://bjs.ojp.gov/data-collection/nps); [ICPSR 38871](https://www.icpsr.umich.edu/web/NACJD/studies/38871); annual *Prisoners* statistical tables (rates per 100k) | Counts/rates **~1978–2023**; state / nation | `store` curated rates; keep counts under distinct metric ids | Public / ICPSR terms | Re-map loader: separate **counts** vs **rates**; backfill true rates before any public rate copy |
| Vera Cook era spine thin | Q6, Q8 | **Vera Incarceration Trends** (`vera-incarceration-trends`) | [GitHub dataset](https://github.com/vera-institute/incarceration-trends); [project](https://www.vera.org/projects/incarceration-trends) | Compiled county/state **1970–2024** | `store` + attribution | Attribution (verify README) | Re-ingest **full Cook/IL time series** (warehouse has national breadth but Cook is a single 2024 point); keep BJS as prison SoT |
| HMDA county lending | Q3 | **FFIEC/CFPB HMDA Data Browser API** (`hmda-loan-level`, aggregate-only) | [Data Browser API](https://ffiec.cfpb.gov/documentation/api/data-browser/); aggregations by `counties=` FIPS + race filters | Modern HMDA **~2018–present** (browser vintages); older snapshots via [data publication](https://ffiec.cfpb.gov/data-publication/) | **`aggregate` only** — never loan-level in public DB | Public (CFPB open data) | County denial / origination rates for Cook `17031`; metrics `hmda-denial-rate-black-county`, gap derived |
| Eviction missing for Cook | Q3, Q4, Q7 | **Eviction Lab** (`eviction-lab`) | [get-the-data](https://evictionlab.org/get-the-data/) | **2000–2018** county (ETS 2020+ separate) | `store` + attribution | Attribution required | Extend ingest to **IL counties** (esp. Cook); current 821 rows do not include `county:17031` |
| National wealth time series | Q3 national spine, Q6 context | **SCF historic tables** (`fed-survey-consumer-finances`) | [SCF index](https://www.federalreserve.gov/econres/scfindex.htm); [FEDS note accessible tables](https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-accessible-20231018.htm); chartbook 1989–2022 | Triennial **1989–2022** median/mean net worth by race (**nation only**) | `store` national series | Public domain federal | Load full SCF race medians (not just 2022); **never** invent county wealth |
| Drug sentencing quantitative | Q5–Q6 | **USSC Quick Facts** (`ussc-quick-facts-drug`) | [Quick Facts](https://www.ussc.gov/research/quick-facts); crack/powder archives | Federal FY series (recent FY + archive back ~2013+) | `cite` → selective `store` of published table cells | Federal public | Artifact + indicator packets for crack/powder sentence lengths & demographics; juxtaposition with statutes |

### P1 — Historical depth (eras beyond ACS 2020–2024)

| Gap | Questions | Recommended source | Access | Years / geo | Strategy | Rights | Fill action |
|-----|-----------|--------------------|--------|-------------|----------|--------|-------------|
| Pre-ACS / multi-decade housing & race | Q3, Q7 | **IPUMS NHGIS** (`nhgis-county-race` + tenure tables) | [nhgis.org](https://www.nhgis.org/); [time-series tables](https://www.nhgis.org/time-series-tables); API key required | Decennial / ACS 5-yr; county (and finer) with crosswalks **~1790–present** for race; tenure by race **~1990+** practical | `cite→store` after key gate | Attribution + NHGIS terms | Register `NHGIS_API_KEY`; load Black/White homeownership & population share for Cook across fair-housing / CRA eras |
| Cost burden / affordability | Q3, Q4 | **HUD CHAS** (`hud-chas`) | [HUDUSER CHAS](https://www.huduser.gov/portal/datasets/cp.html) | ACS-based multi-year releases; tract/county/state | `store` | Public | Define `hud-chas-cost-burden-*-county` beside ACS ownership |
| Jail vs prison distinction | Q6, Q8 | **BJS Annual Survey of Jails** (`bjs-annual-survey-of-jails`) | [ASJ](https://bjs.ojp.gov/data-collection/asj) | Annual; jurisdiction aggregates | `aggregate` | Public | Complement Vera; facility-level dignity-gated |
| Modeled neighborhood outcome (cohort) | Q6 optional | **Opportunity Atlas** (`opportunity-atlas-tract-outcomes`) | [opportunityinsights.org/data](https://opportunityinsights.org/data/) | 2018 release; **2010 tracts** | `store` subset, label **`modeled`** | Attribution | Never as jurisdiction imprisonment rate |
| HOLC grade shares for maps | Q2, Q4 | **Mapping Inequality** (`mapping-inequality-holc`) | DSL panorama / JSON | ~1935–1940 city polygons | `gated→store` | **CC BY-NC-SA** — commercial surface blocked | Keep public **cite-only** until rights review; staff research surfaces only for polygons |

### P2 — Next themes (system capacity)

| Gap | Questions | Recommended source | Access | Years / geo | Strategy | Rights | Fill action |
|-----|-----------|--------------------|--------|-------------|----------|--------|-------------|
| Urban renewal project geography | Q7 | **DSL Renewing Inequality** (`dsl-renewing-inequality`) | [map](https://dsl.richmond.edu/panorama/renewal/); [GitHub data](https://github.com/americanpanorama/Renewing_Inequality_Data); federal characteristics reports 1955–1966 | Project attributes **1955–1966**; polygons incomplete by city | `gated→store` / cite | Same DSL family as HOLC — **rights review before commercial** | Registered; Chicago attribute fixture; polygons cite/staff-gated — [rights checklist](./dsl-renewing-inequality-rights.md) §6 |
| Environmental burden | Q9 | **CDC EJI** (`cdc-eji`) + **EPA TRI** (`epa-tri`) + optional **Superfund NPL** (`epa-superfund-npl`) | [EJI download](https://www.atsdr.cdc.gov/placeandhealth/eji/eji-data-download.html); [TRI basic files](https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present) | EJI 2024 tract; TRI **1987–present** facility | `store` rollups | Public | Juxtapose burden metrics with `acs-black-population-share`; **no alarm-red crime-style heat** |
| Mass incarceration state spine | Q8 | Same as Q6: fixed BJS rates + Vera + ASJ | see P0 | multi-decade state | `store` | Public | Dedicated Q8 packets once rates QA closes |
| Contested drug-market FOIA | Q5 | National Archives / FOIA reading rooms + peer-reviewed historiography (not a single SoT) | Case-by-case | 1970s–1990s | `cite` + `uncertaintyLabel` | Varies | Continue contested placeholder; promote individual primary docs only after editorial + rights |

## 4. Sources explicitly rejected or held for this product

| Source / pattern | Reason |
|------------------|--------|
| UCR crime-rate map heat | Dignity + voluntary reporting bias (matrix §D) |
| County wealth invented from SCF/SIPP | Geography mismatch — national only |
| HMDA loan-level in public DB | Registry strategy is aggregate-only |
| PPI / Sentencing Project as SoT | Strong synthesis — **cite secondary**; prefer BJS/Vera/USSC tables |
| Mapping Inequality polygons on commercial anon surfaces | NC license — cite-only until rights review |
| Modeled Opportunity Atlas as “imprisonment rate” | Cohort outcome, not jurisdiction rate |

## 5. Recommended ingest order (when approved)

1. **BJS rate QA / rematerialize** from published *Prisoners* tables or ICPSR rates → unblocks Q6/Q8 (`repo-bba2`).
2. **Vera full Cook/IL jail time series** from GitHub release → real drug-policy era charts (not single 2024 point).
3. **SCF 1989–2022 race medians** national spine → wealth era depth (no new geo invention).
4. **HMDA Data Browser county aggregates** for Cook → clears Chicago HMDA defer.
5. **Eviction Lab IL/Cook extension** → Q3/Q4 housing-stress (national file exists; Cook not loaded yet).
6. **NHGIS key + tenure/race time series** → fair-housing / CRA era ACS predecessors.
7. **DSL Renewing Inequality rights review (commercial gate)** → Q7 polygons remain cite-only until [checklist](./dsl-renewing-inequality-rights.md) §6 passes; attributes fixture already registered.
8. **CDC EJI + EPA TRI county rollups** → unlock Q9.
9. **USSC Quick Facts** selective store → drug sentencing quantitative beside statutes.

## 6. Registry follow-ups (docs / code, not ingest)

| Action | Detail |
|--------|--------|
| ~~Add proposed~~ | ~~`ussc-quick-facts-drug`, `dsl-renewing-inequality`~~ — **done** in `external-data-sources.ts` |
| Matrix hygiene | ~~§B still lists BJS/Vera/SCF/SIPP as “proposed”~~ — **done** (`docs/research/context-data-source-matrix.md` §A–§B, 2026-07-22) |
| DSL commercial gate | Human checklist in [dsl-renewing-inequality-rights.md](./dsl-renewing-inequality-rights.md) §6 — polygons stay blocked on commercial surfaces |
| Keep disabled until beads | All fills require explicit ingestion approval; this memo is not that approval |

## 7. Acceptance for this research bead

- [x] Gaps mapped to concrete custodians and URLs  
- [x] Years / geography / strategy / rights noted  
- [x] Ordered next ingest list  
- [x] Research pass itself performed no live ingest  

**Executed follow-on (2026-07-22, `feat/theme-impact-gap-ingest`):** BJS denominators fixed + rates re-applied; Vera IL multi-year; SCF 1989–2022; Eviction IL (incl. Cook); HMDA Cook **live** 2018–2023 (18 observations after FFIEC response normalize); Q6 packet published with corrected BJS rates. Obsolete theme-impact/BJS stashes dropped; orphan scaffold tree removed.

**P1/P2 gap-fill wave (same branch, 2026-07-22):**
- **NHGIS** Cook `17031` Black/White population shares **1970–2010** (10 obs) and tenure-by-race homeownership **1990–2010** (6 obs; Black **37.1%** / **42.0%** / **41.2%**, White **63.8%** / **66.7%** / **67.2%**).
- **DSL Renewing Inequality** registered noncommercial; Chicago attributes fixture (5 pilot / 43 source projects); polygons cite/staff-gated — no commercial apply.
- **CDC EJI + EPA TRI** expanded to all Illinois counties via live Envirofacts + Zenodo EJI 2024 national filter (**263** obs applied: EJI **102** counties, TRI **82** counties × 2022–2023; Cook EJI **0.7469** from **1328** tracts, TRI **305** facilities in 2023 — prior 3-county pilot fixture had Cook EJI **0.74** / TRI **12**). Live path: CDC state CSV 404 → Zenodo national → `.cache/phase1-eji-tri/`; TRI joins `tri_facility` + `tri_reporting_form`. Committed rollups: `eji-il-counties-full.csv`, `tri-il-counties-full.csv`.
- **HUD CHAS** Cook `17031` Con Plan Table 20 cost-burden-by-race (**2** obs, CHAS 2016–2020; Black **44.6%**, White **31.3%** burden >30%; Suburban Cook jurisdiction).
- **USSC Quick Facts** crack/powder average sentences + Black crack share (**26** FY obs, 2013–2023).
- Theme-impact Q3/Q4/Q6/Q7/Q9 bindings updated; v1 source allowlist extended (`hud-chas`).

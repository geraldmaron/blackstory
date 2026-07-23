<!--
  In-repo source matrix for research/context indicators (justice, wealth, housing,
  education, health, voting). Complements external-data-sources.ts and the landscape intake.
  Store / cite / proxy decisions — registration is never approval to ingest.
-->

# Context data source matrix

**Purpose:** Ranked catalog of datasets that support place-time **context indicators** for research and MCP — incarceration, wealth proxies, housing, education, health, voting — without folding statistics into free-text heritage claims.

**Companion docs:** [data-ingestion-methodology.md](../runbooks/data-ingestion-methodology.md), [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md), [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md), [external-data-sources.ts](../../packages/domain/src/external-data-sources.ts), [public-mcp-unlock-criteria.md](public-mcp-unlock-criteria.md).

**Lane rule:** Statistics → `bb_reference` / `StatisticalSeries` path. Entity corpora → launch-corpora / landscape candidates. Never mix.

## Legend

| Column | Meaning |
|--------|---------|
| **Strategy** | `store` curated series; `aggregate` store rollups only; `cite` DOI/URL proxy; `secondary` attribute synthesis only; `gated` rights/dignity hold |
| **Registry** | Id in `EXTERNAL_DATA_SOURCES` (`disabled` until an ingestion bead enables the adapter), or `proposed` until added |
| **Ingest** | `ingested` warehouse/fixture rows exist; `fixture` pilot-only; `registered` metadata only; `optional` registered but no bead yet |
| **Theme** | justice / wealth / housing / education / health / labor / voting / historical |

---

## A. Registered (`registryState: disabled` — ingestion beads enable adapters)

| Id | Theme | Strategy | Ingest | License | Geography | Notes |
|----|-------|----------|--------|---------|-----------|-------|
| `opportunity-atlas-tract-outcomes` | justice / wealth | store (subset) | optional | attribution | tract (2010) | Checksum recorded; child cohort outcomes — **modeled**, not jurisdiction imprisonment rates; needs 2010→2020 crosswalk |
| `mapping-inequality-holc` | housing / historical | gated → store | fixture | NC | city polygons | Staff inventory in `bb_reference.holc_areas`; public **cite-only** until commercial-surface rights review |
| `dsl-renewing-inequality` | housing / historical | gated → store | fixture | NC | city | Chicago attributes fixture (43 projects / 5 pilot); polygons **cite/staff-gated** — see [dsl-renewing-inequality-rights.md](./dsl-renewing-inequality-rights.md) |
| `fbi-ucr-hate-crime` | justice | store + participation | registered | PD | county×year | Only with `fbi-ucr-participation` denominator |
| `fbi-ucr-agency-directory` | justice | store | registered | PD | agency | Crosswalk for UCR |
| `fbi-ucr-participation` | justice | store | registered | PD | state×year | Coverage denominator (required) |
| `bjs-national-prisoner-statistics` | justice | store | ingested | PD | state / nation | NPS rates rematerialized (2022–2023); counts under distinct metric ids |
| `vera-incarceration-trends` | justice | store | ingested | attribution | county / state | Cook `17031` jail time series **1970–2024**; BJS NPS remains prison SoT |
| `bjs-annual-survey-of-jails` | justice | aggregate | optional | PD | state / facility | Registered; jail distinct from prison — no Phase 1 ingest bead yet |
| `bjs-ncrp-public-use` | justice | cite | optional | ICPSR | state / facility | Registered; person-level — store derived aggregates only if a bead produces them |
| `ussc-quick-facts-drug` | justice | cite → store | ingested | PD | nation | FY2013–2023 crack/powder sentence cells (26 obs) |
| `stanford-open-policing` | justice | cite / aggregate | optional | attribution | city / facility | Registered; dignity-gated — agency aggregates only after review |
| `hmda-loan-level` | housing / wealth | aggregate | ingested | PD | county+ | Cook `17031` denial/origination rollups **2018–2023** (18 obs); never loan-level in public DB |
| `hud-chas` | housing | store | registered | PD | county | Affordability / cost burden |
| `crdc-school-civil-rights` | education | aggregate | registered | PD | school/district | Discipline / access disparities |
| `seda-education-archive` | education | gated | registered | NC | district | Rights review before public |
| `cdc-places` | health | store | registered | PD | tract/county | Place-level health outcomes |
| `cdc-svi` | health | store | registered | PD | tract/county | Social Vulnerability Index |
| `cdc-eji` | health | store | ingested | PD | tract | IL county fixture rollups (Cook EJI mean **0.74**, 2024 vintage) |
| `sundown-towns-osf` | historical | gated | registered | unverified | place | Dignity + rights review |
| `lehd-lodes` | labor | store | registered | PD | block/tract | Jobs / commute |
| `eviction-lab` | housing | store | ingested | attribution | county/tract | IL counties incl. Cook `17031` loaded (2000–2018 national file) |
| `usda-food-access` | health | store | registered | PD | tract | Food access |
| `epa-tri` | health | store | ingested | PD | facility | IL county facility rollups (Cook **12** facilities, 2023) |
| `epa-superfund-npl` | health | store | optional | PD | facility | Registered; NPL boundaries — no ingest bead yet (EJI/TRI cover Q9 pilot) |
| `fema-nri` | health | store | registered | PD | tract/county | Hazard risk |
| `fed-survey-consumer-finances` | wealth | store (national) | ingested | PD | nation | SCF race medians **1989–2022** — never invent county wealth |
| `census-sipp-wealth` | wealth | store (national) + cite | optional | PD | nation | Registered; complements SCF — prefer published briefs for Phase 1 |
| `census-abs` | labor / wealth | store | registered | PD | county/state | Black-owned employer firms |
| `census-nesd` | labor / wealth | store | registered | PD | county/state | Black-owned nonemployers |
| `bls-laus-unemployment` | labor | store | optional | PD | state / metro | Registered; race slices only where BLS publishes |
| `us-census-historical-race-1790-1990` | historical | store | ingested | PD | nation/state | Timeline lane (national + state decades) |
| `nhgis-county-race` | historical | cite→store | ingested | attribution | county | Cook `17031` Black/White population shares **1970–2010** (10 obs); live extract still needs `NHGIS_API_KEY` |
| `slavevoyages-transatlantic` | historical | gated | registered | NC | flow/nation | Forced-migration **flow**, not resident pop |
| `fcc-broadband-map` | labor | aggregate | registered | PD | address/bg | Access disparity context |
| `mit-election-lab` | voting | cite / selective store | optional | attribution | state / county | Registered; election-admin context — verify terms per dataset |
| `voting-rights-lab-indicators` | voting | cite / selective | optional | attribution | state | Registered; confirm redistribution before bulk load |

**ACS / decennial** live primarily under census-demographics adapters and `bb_reference.acs_*` / `census_*` tables (not every variable is an `EXTERNAL_DATA_SOURCES` row). Treat ACS race-sliced income, poverty, homeownership, and attainment as **Phase 1 store** targets.

---

## B. Secondary / not yet registered (cite only — do not add without a bead)

| Proposed id | Custodian | Theme | Strategy | License (expected) | Geography | Why |
|-------------|-----------|-------|----------|-------------------|-----------|-----|
| `brennan-center-voting` | Brennan Center | voting | secondary | cite | state | Synthesis — attribute, prefer primary MIT/VRL rows in §A |
| `prison-policy-initiative-profiles` | PPI | justice | secondary | cite | state | Strong synthesis; not SoT unless raw tables clear |

**Hygiene note (2026-07-22):** BJS NPS, Vera, SCF, SIPP, USSC, NHGIS, HMDA, EJI, TRI, and DSL Renewing Inequality were previously listed here as “proposed” but are now **`EXTERNAL_DATA_SOURCES` rows** (§A). Optional registered ids without ingest beads yet: `bjs-annual-survey-of-jails`, `opportunity-atlas-tract-outcomes`, `epa-superfund-npl`, `bls-laus-unemployment`, `mit-election-lab`, `voting-rights-lab-indicators`, `stanford-open-policing`.

---

## C. Reputable secondary (cite only — do not scrape into SoR)

| Source | Theme | Use |
|--------|-------|-----|
| Pew Research Center — Black Americans fact sheets | wealth / demography | Framing citations |
| Economic Policy Institute — disparities chartbook | wealth / justice | Framing citations |
| Urban Institute / Brookings explainers | policy | Framing |
| Sentencing Project fact sheets | justice | Framing |
| Black Wealth Data / similar portals | wealth | UX inspiration; prefer ACS primary |

---

## D. Explicit non-goals / gated

- UCR **crime** rates as map heat (dignity + voluntary reporting bias)
- Living-person directories / privacy-sensitive Green Book enrich without review
- `noncommercial` / `unverified` on public commercial surfaces until rights review
- Mass Enslaved.org import as general Black history SoR
- Public heritage MCP until [unlock criteria](public-mcp-unlock-criteria.md) pass
- Invented causal “Policy X caused rate Y” published facts without peer-reviewed claim evidence

---

## E. Phase 1 indicator MVP (county + state catalog)

Curated metrics (~15–25) for bounded `/data` and operator MCP — race-sliced where valid:

1. ACS: Black population share; median household income (Black / White); poverty; homeownership; BA attainment  
2. Imprisonment: state rates by race (**BJS NPS ingested**; Vera county jail series for context)  
3. Eviction Lab county filings (attribution; **Cook loaded**)  
4. HOLC / DSL urban renewal: **cite-only** on public commercial surfaces until rights review clears polygons  
5. Opportunity Atlas incarceration **outcome** (optional) — label `modeled` / cohort; not a jurisdiction rate  

Definitions live in `packages/domain/src/statistics/phase1-indicator-catalog.ts`. Ingest status for the gap-fill wave: [theme-impact-gap-fill-sources.md](./theme-impact-gap-fill-sources.md) §2–§6.

---

## F. Store vs cite decision tree

```
Need place×time indicator for map/MCP?
  ├─ High reuse, stable geo, clear license → STORE curated StatisticalSeries
  ├─ Microdata too large / PII risk → AGGREGATE then store rollups
  ├─ Restricted / one-off research depth → CITE (DOI + variable glossary)
  └─ Someone else’s synthesis → SECONDARY cite only
```

**How much to store:** enough for bounded context panels and MCP tools — not a second Census Bureau. Prefer refreshable loaders over git-checked megabytes.

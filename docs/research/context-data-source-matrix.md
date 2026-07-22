<!--
  In-repo source matrix for research/context indicators (justice, wealth, housing,
  education, health, voting). Complements external-data-sources.ts and the landscape intake.
  Store / cite / proxy decisions — registration is never approval to ingest.
-->

# Context data source matrix

**Purpose:** Ranked catalog of datasets that support place-time **context indicators** for research and MCP — incarceration, wealth proxies, housing, education, health, voting — without folding statistics into free-text heritage claims.

**Companion docs:** [data-ingestion-methodology.md](../runbooks/data-ingestion-methodology.md), [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md), [external-data-sources.ts](../../packages/domain/src/external-data-sources.ts), [public-mcp-unlock-criteria.md](public-mcp-unlock-criteria.md).

**Lane rule:** Statistics → `bb_reference` / `StatisticalSeries` path. Entity corpora → launch-corpora / landscape candidates. Never mix.

## Legend

| Column | Meaning |
|--------|---------|
| **Strategy** | `store` curated series; `aggregate` store rollups only; `cite` DOI/URL proxy; `secondary` attribute synthesis only; `gated` rights/dignity hold |
| **Registry** | Id in `EXTERNAL_DATA_SOURCES`, or `proposed` until added |
| **Theme** | justice / wealth / housing / education / health / labor / voting / historical |

---

## A. Registered (disabled until ingestion beads)

| Id | Theme | Strategy | License | Geography | Notes |
|----|-------|----------|---------|-----------|-------|
| `opportunity-atlas-tract-outcomes` | justice / wealth | store (subset) | attribution | tract (2010) | Child cohort incarceration/income — **modeled**, not jurisdiction imprisonment rates; needs crosswalk |
| `mapping-inequality-holc` | housing / historical | gated → store | NC | city polygons | Rights review before commercial surface |
| `fbi-ucr-hate-crime` | justice | store + participation | PD | county×year | Only with `fbi-ucr-participation` denominator |
| `fbi-ucr-agency-directory` | justice | store | PD | agency | Crosswalk for UCR |
| `fbi-ucr-participation` | justice | store | PD | state×year | Coverage denominator (required) |
| `hmda-loan-level` | housing / wealth | aggregate | PD | county+ | Never full loan-level in public DB |
| `hud-chas` | housing | store | PD | county | Affordability / cost burden |
| `crdc-school-civil-rights` | education | aggregate | PD | school/district | Discipline / access disparities |
| `seda-education-archive` | education | gated | NC | district | Rights review before public |
| `cdc-places` | health | store | PD | tract/county | Place-level health outcomes |
| `cdc-svi` | health | store | PD | tract/county | Social Vulnerability Index |
| `cdc-eji` | health | store | PD | tract | Environmental Justice Index |
| `sundown-towns-osf` | historical | gated | unverified | place | Dignity + rights review |
| `lehd-lodes` | labor | store | PD | block/tract | Jobs / commute |
| `eviction-lab` | housing | store | attribution | county/tract | Filing rates; cite Eviction Lab |
| `usda-food-access` | health | store | PD | tract | Food access |
| `epa-tri` | health | store | PD | facility | Toxics release |
| `epa-superfund-npl` | health | store | PD | facility | Superfund sites |
| `fema-nri` | health | store | PD | tract/county | Hazard risk |
| `census-abs` | labor / wealth | store | PD | county/state | Black-owned employer firms |
| `census-nesd` | labor / wealth | store | PD | county/state | Black-owned nonemployers |
| `us-census-historical-race-1790-1990` | historical | store | PD | nation/state | Timeline lane (already partially used) |
| `nhgis-county-race` | historical | cite→store | attribution | county | Blocked on `NHGIS_API_KEY` |
| `slavevoyages-transatlantic` | historical | gated | NC | flow/nation | Forced-migration **flow**, not resident pop |
| `fcc-broadband-map` | labor | aggregate | PD | address/bg | Access disparity context |

**ACS / decennial** live primarily under census-demographics adapters and `bb_reference.acs_*` / `census_*` tables (not every variable is an `EXTERNAL_DATA_SOURCES` row). Treat ACS race-sliced income, poverty, homeownership, and attainment as **Phase 1 store** targets.

---

## B. Proposed primary sources (add to registry; remain disabled)

| Proposed id | Custodian | Theme | Strategy | License (expected) | Geography | Why |
|-------------|-----------|-------|----------|-------------------|-----------|-----|
| `bjs-national-prisoner-statistics` | BJS / ICPSR | justice | store | PD / ICPSR terms | state / federal | Canonical imprisonment counts & rates by race |
| `vera-incarceration-trends` | Vera Institute | justice | store | attribution (verify) | county / state | Place-indexed incarceration trends |
| `bjs-annual-survey-of-jails` | BJS | justice | aggregate | PD | state / jurisdiction | Jail distinct from prison |
| `bjs-ncrp-public-use` | BJS / ICPSR | justice | cite | ICPSR | person-level | Too large; store only derived state/year tables |
| `fed-survey-consumer-finances` | Federal Reserve | wealth | store (national) | PD | nation | Gold-standard wealth by race — not county |
| `census-sipp-wealth` | Census SIPP | wealth | store (national) + cite | PD | nation | Complements SCF |
| `bls-laus-unemployment` | BLS | labor | store | PD | state / metro | Unemployment context where race slice exists |
| `mit-election-lab` | MIT Election Data + Science Lab | voting | cite / selective store | academic terms | state/county | Election results / admin context |
| `voting-rights-lab-indicators` | Voting Rights Lab | voting | cite / selective | NGO terms | state | Franchise / election-admin indicators |
| `brennan-center-voting` | Brennan Center | voting | secondary | cite | state | Synthesis — attribute, prefer primary |
| `stanford-open-policing` | Stanford | justice | cite / aggregate | academic | agency | High sensitivity; aggregates only |
| `prison-policy-initiative-profiles` | PPI | justice | secondary | cite | state | Strong synthesis; not SoT unless raw tables clear |

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
2. Imprisonment: state rates by race (NPS or Vera aggregates)  
3. Eviction Lab county filings (attribution)  
4. HOLC overlay on research/noncommercial surfaces first  
5. Opportunity Atlas incarceration **outcome** labeled `modeled` / cohort  

Definitions live in `packages/domain/src/statistics/phase1-indicator-catalog.ts`.

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

<!--
  Product vocabulary for the reusable theme-impact system: canonical questions,
  policy eras, metric bindings, and artifact lanes. Complements Phase 1 indicators
  and juxtaposition-not-causation methodology. Not an ingestion approval.
-->

# Theme impact — canonical questions and metric catalog

**Status:** Draft v1 (survey-locked 2026-07-22)  
**Bead:** catalog workstream (questions → system design → pilot)  
**Companions:** [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md), [context-data-source-matrix.md](./context-data-source-matrix.md), [theme-impact-gap-fill-sources.md](./theme-impact-gap-fill-sources.md), `packages/domain/src/statistics/phase1-indicator-catalog.ts`, `theme-impact-questions.ts`

## 1. Product posture (from survey)

| Decision | Choice |
|----------|--------|
| Audience | Public readers, educators/students, journalists/researchers |
| Surfaces | Stories with charts, map context panels, themes/impact browse |
| Near-term success | Reusable **theme-impact system**, then fill themes |
| Causation | Juxtaposition by default; causal language only behind a higher claim gate |
| Provenance | Full quartet (`source`, `source_url`, `retrieved_at`, `content_hash`) + human citation |
| Gaps | “Insufficient evidence” **and** clearly labeled modeled estimates |
| Structure | Shared evidence base; **standalone themes** and **entity-bound** views |
| Risk | Show more with strong caveats / uncertainty labels |
| Geography / coverage | Flexible by theme; theme-dependent depth (thin national spine where useful + deep pilots) |
| Time framing | **Policy eras** (not raw annual-only UX) |

**Build sequence:** canonical questions + metric catalog → system design → one metro × one theme pilot.

## 2. Theme priority

| Priority | Theme id | Notes |
|----------|----------|-------|
| P0 | `redlining` | Origins, geography, outcomes, place narrative |
| P0 | `drug_policy_state` | Artifact timelines **and** quantitative impact |
| P1 | `urban_renewal` | Same system later |
| P1 | `mass_incarceration` | Overlaps justice Phase 1 metrics |
| P1 | `environmental_racism` | EPA/EJ family when opened |

## 3. Policy eras (product time axis)

Eras are **UX / binding labels**. Underlying observations keep their native `reference_period` (year, ACS vintage, etc.). Derived or story packets may roll observations into an era with an explicit method note.

### 3.1 Redlining / housing credit

| Era id | Label | Approx. span | Anchor |
|--------|-------|--------------|--------|
| `holc_fha` | HOLC / FHA grading & federal mortgage gatekeeping | ~1933–1968 | HOLC maps; FHA underwriting |
| `fair_housing` | Fair Housing & early enforcement | ~1968–1980s | Fair Housing Act 1968 |
| `cra_contemporary` | CRA / contemporary lending disparity | ~1977–present | Community Reinvestment Act; HMDA |

### 3.2 Drug policy / enforcement

| Era id | Label | Approx. span | Anchor |
|--------|-------|--------------|--------|
| `pre_drug_war` | Pre–drug-war enforcement baseline | through ~1970 | Documented local/federal practice |
| `drug_war_escalation` | Escalation & scheduling | ~1971–1985 | Controlled Substances Act era expansion |
| `crack_cocaine_era` | Crack / mandatory-minimum peak | ~1986–2000s | Anti-Drug Abuse Acts; sentencing disparity |
| `sentencing_reform` | Reform & partial rollback | ~2010–present | Fair Sentencing Act and related reforms |

Era boundaries are editorial; publish the span + anchors with citations. Do not imply every jurisdiction entered each era on the same day.

## 4. Canonical questions (10)

Each question is **answerable** as a product packet: narrative + observations/derived metrics and/or dated artifacts. Default language is juxtaposition; causal claims only as gated heritage claims.

| Id | Theme | Question | Answer shape |
|----|-------|----------|--------------|
| `Q1` | `redlining` | How did federal and local redlining practices come about? | Artifact timeline + claim set (origins) |
| `Q2` | `redlining` | Where was HOLC grading applied, and how were Black neighborhoods graded? | Polygon / city geography + grade distribution |
| `Q3` | `redlining` | Across housing-credit policy eras, how did Black homeownership, income, poverty, and wealth change in places with redlining history? | Era-indexed indicators + optional derived gaps |
| `Q4` | `redlining` | For a specific formerly graded place, what followed for the people who lived there? | Place narrative bound to entity + local indicators |
| `Q5` | `drug_policy_state` | What documented government actions and artifacts describe state involvement in drug markets or drug-war enforcement affecting Black communities? | Artifact timeline (primary + editorial uncertainty) |
| `Q6` | `drug_policy_state` | Across drug-policy eras, how did Black imprisonment / jail rates and related justice indicators change? | Era-indexed justice series + derived ratios |
| `Q7` | `urban_renewal` | Where were major urban renewal / displacement projects, and what demographic change followed in affected places? | P1 — geography + demography eras |
| `Q8` | `mass_incarceration` | How did Black adult imprisonment rates change by state across modern justice eras? | P1 — largely Phase 1 justice metrics |
| `Q9` | `environmental_racism` | How do environmental burden indicators concentrate relative to Black population share? | P1 — EJ/TRI/EJI beside demography |
| `Q10` | cross-cutting | When is “impact” language allowed in the product? | Methodology gate (not a dataset) |

**v1 implement focus:** `Q1`–`Q6` + `Q10`. Keep `Q7`–`Q9` as system-capacity proofs (same packet shape).

## 5. Metric catalog (v1)

### 5.1 Reuse Phase 1 series (already defined)

| Metric id | Themes / questions | Role |
|-----------|--------------------|------|
| `acs-black-population-share-county` | Q3, Q4, Q7, Q9 | Demography spine |
| `acs-median-hh-income-black-county` | Q3, Q4 | Outcome |
| `acs-median-hh-income-white-county` | Q3 | Gap input |
| `acs-poverty-rate-black-county` | Q3, Q4 | Outcome |
| `acs-homeownership-rate-black-county` | Q3, Q4 | Core redlining outcome |
| `acs-ba-attainment-black-county` | Q3, Q4 | Optional education context |
| `scf-median-wealth-black-nation` | Q3 | National wealth spine |
| `scf-median-wealth-white-nation` | Q3 | Gap input |
| `sipp-median-wealth-black-nation` | Q3 | Wealth corroboration |
| `imprisonment-rate-black-state` | Q6, Q8 | Core justice outcome |
| `imprisonment-rate-white-state` | Q6, Q8 | Gap input |
| `vera-jail-population-rate-county` | Q6, Q8 | Local justice |
| `eviction-filing-rate-county` | Q3, Q4 | Housing stress |
| `oa-incarceration-outcome-black-tract` | Q6, Q8 | **Modeled** cohort outcome only; never as jurisdiction imprisonment |

Historical census decade series (national/county) remain available for long-run demography beside policy eras — see [national-black-population-timeline.md](../methodology/national-black-population-timeline.md).

### 5.2 Proposed series (add when ingestion beads open)

| Proposed metric id | Source family | Geography | Questions | Notes |
|--------------------|---------------|-----------|-----------|-------|
| `holc-grade-area-share-city` | `mapping-inequality-holc` | city / custom polygon | Q2, Q4 | Share of city area (or housing) by HOLC grade; rights-gated |
| `holc-black-pop-share-by-grade` | HOLC ∩ historical race | HOLC poly × era | Q2, Q3 | Requires crosswalk + dignity review |
| `hmda-denial-rate-black-county` | `hmda-loan-level` → aggregate | county+ | Q3 | Aggregate only; never full loan-level public DB |
| `hmda-denial-rate-gap-county` | derived from HMDA | county+ | Q3 | `DerivedMeasurement` |
| `hud-chas-cost-burden-black-county` | `hud-chas` | county | Q3, Q4 | Affordability |
| `cdc-eji-tract` | `cdc-eji` | tract | Q9 | P1 environmental |
| `epa-tri-facility-count-county` | `epa-tri` | county | Q9 | P1 environmental |

### 5.3 Derived measurements (allowed formulas)

Always `status: 'derived' | 'modeled'` with formula + input observation ids.

| Method id | Formula intent | Questions | Public language |
|-----------|----------------|-----------|-----------------|
| `black_white_income_gap` | Black − White median HH income (or ratio) | Q3 | Gap, not “caused by redlining” |
| `black_white_imprisonment_ratio` | Black / White imprisonment rate | Q6, Q8 | Ratio with provenance |
| `holc_d_vs_a_homeownership_delta` | Homeownership in D-graded vs A-graded zones (same city/era) | Q3, Q4 | Juxtaposition; crosswalk required |
| `era_delta` | Observation at era-end − era-start for same metric/jurisdiction | Q3, Q6 | Change over era; not causation |

### 5.4 Artifact / evidence lanes (not StatisticalSeries)

Used especially for `Q1`, `Q5`, and place narrative `Q4`.

| Artifact class | Examples | Storage lane | Public bar |
|----------------|----------|--------------|------------|
| Primary government document | HOLC manuals, FHA underwriting, statutes, declassified memos | `bb_evidence` captures + claims | Prefer primary; uncertainty labels OK |
| Cartographic grade maps | Mapping Inequality HOLC | Geo + attribution; registry gated | Rights review before commercial surface |
| Peer-reviewed synthesis | Journal articles on redlining wealth effects; drug-war sentencing | Cite in claims; optional secondary | “Sprinkle” of peer review for contested topics |
| Investigative / FOIA packages | Documented distribution or enforcement programs | Capture + editorial packet | Show with caveats; do not present rumor as fact |
| Scholarly partner tables | Licensed aggregates | `bb_reference` if store-approved | Partnership terms |

## 6. v1 dataset allowlist (recommended)

Ordered for the reusable system + first pilots:

1. **`mapping-inequality-holc`** — geography for Q2/Q4 (gated → store after rights)
2. **ACS + historical census** — demography/housing/income spine (already in reference path)
3. **HMDA aggregates** — lending outcomes for Q3 (aggregate only)
4. **BJS NPS + Vera** — justice series for Q6/Q8 (Phase 1 ids)
5. **SCF / SIPP (national)** — wealth spine for Q3
6. **Primary gov docs + peer-reviewed syntheses** — artifact timelines for Q1/Q5

**Defer / dignity hold:** UCR crime heat maps; thin FOIA dumps without editorial synthesis; Opportunity Atlas as if it were jurisdiction imprisonment.

## 7. Packet contract (what “answering” a question means)

Every public theme-impact packet for `Q1`–`Q9` should carry:

1. **Question id** + theme id  
2. **Policy era(s)** in scope  
3. **Geography** (flexible; declare unit + `boundary_version`)  
4. **Observations / derived** with full provenance quartet + human citation  
5. **Artifacts / claims** with independence / uncertainty labels where contested  
6. **Method note:** juxtaposition vs gated causal claim  
7. **Gap states:** `insufficient_evidence` and/or `modeled` labels when applicable  

Entity-bound views add `entity_context_bindings` (purpose: `map_panel` | `story` | `research`). Standalone theme pages use the same packet without requiring a single heritage entity.

## 8. Out of scope for this catalog

- Postgres migration apply (follow-on bead after [ADR-029](../adr/ADR-029-theme-impact-packets.md))
- Live ingestion or cloud apply
- Public MCP exposure
- Auto-generated causal impact claims from co-moving series

**System design (locked):** [theme-impact-packet-system.md](./theme-impact-packet-system.md)

## 9. Next steps

1. **Pilot** — one metro × `redlining` (`Q1`–`Q4`) end-to-end with citations ([checklist §8](./theme-impact-packet-system.md#8-redlining-pilot-readiness-checklist))  
2. Schema migration — `bb_canonical.theme_impact_packets` + release projection per design doc  
3. Open ingestion beads only for allowlisted sources still `disabled` in the registry  

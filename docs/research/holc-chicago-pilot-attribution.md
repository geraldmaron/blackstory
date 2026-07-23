<!--
  Chicago metro redlining pilot: Mapping Inequality / HOLC rights posture, staff inventory,
  and cite-only public artifact rules for ThemeImpactPacket Q1–Q4. Implements pilot gate 2.
-->

# HOLC Chicago pilot — Mapping Inequality attribution and rights posture

**Status:** Locked for pilot (2026-07-22)  
**Pilot scope:** Theme impact packets `Q1`–`Q4`, theme `redlining`  
**Companion:** [theme-impact-packet-system.md](./theme-impact-packet-system.md) §8 gate 2, [context-data-source-matrix.md](./context-data-source-matrix.md), [ADR-029](../adr/ADR-029-theme-impact-packets.md)

## 1. Pilot geography

| Field | Value |
|-------|-------|
| Metro scope key | `metro:chicago-il` |
| Cook County FIPS | `17031` |
| DuPage County FIPS | `17043` |
| Display label | Chicago metropolitan area (Cook + DuPage counties) |
| Boundary version (county indicators) | `county-2020` |

County-level Phase 1 indicators (ACS homeownership, income, poverty, attainment) load against
`17031` and `17043`. HOLC context references Chicago city survey polygons from Mapping
Inequality — not a county choropleth product.

## 2. Source and rights layers

**Custodian:** University of Richmond Digital Scholarship Lab (Mapping Inequality project)  
**Homepage (public cite target):** https://dsl.richmond.edu/panorama/redlining/

Two distinct rights layers apply (corrected 2026-07-18; see `launch-corpora.ts` and
`external-data-sources.ts`):

| Layer | What it is | License posture |
|-------|------------|-----------------|
| **NARA source scans** | Original HOLC Residential Security Maps (U.S. federal records) | Public domain (17 U.S.C. §105) |
| **DSL vector derivatives** | Georectified polygons, grades, and downloadable GeoJSON (`mappinginequality.json`) | **CC BY-NC-SA 4.0** — attribution required; **noncommercial use only**; share-alike on derivatives |

**Registry id:** `mapping-inequality-holc`  
**Registry state:** `disabled` (unchanged for this pilot)  
**License verdict:** `noncommercial` in `EXTERNAL_DATA_SOURCES`

Registration is not approval to ingest or ship geometry on public surfaces. The registry entry
documents custodian, homepage, and rights posture only.

### Prohibited for this pilot

- Do **not** scrape or download `mappinginequality.json` as part of public packet authoring
  or web build steps.
- Do **not** flip `registryState` to `enabled` without a separate rights-review bead.
- Do **not** ship NC GeoJSON polygons, tile layers, or derived grade choropleths on
  **public or commercial** product surfaces without a completed rights review (or
  re-derivation from NARA scans under counsel).

## 3. Staff inventory (`bb_reference.holc_areas`)

Polygons already exist in Postgres for staff research workflows. RLS restricts SELECT to
authenticated staff roles (`admin`, `research`, `publication`); anon has no access.

| Inventory fact | Value |
|----------------|-------|
| Chicago-tagged rows | **703** (`payload.city` matches Chicago) |
| Grade A | 48 |
| Grade B | 160 |
| Grade C | 326 |
| Grade D | 147 |
| Grade unknown / absent | 22 (`payload.grade` null) |

These counts describe **internal reference inventory**, not a published map product. Staff may
use them for crosswalk QA, juxtaposition research, and packet authoring — they do not authorize
public polygon rendering.

Table shape: `bb_reference.holc_areas` — `id`, `payload` (city, state, grade, category, …),
optional `geometry` / `location`, provenance columns (`source`, `source_url`, `retrieved_at`,
`content_hash`).

## 4. Public product rule (cite-only artifacts)

For the redlining pilot on `/themes`, story embeds, and map context panels:

1. **Cite the Mapping Inequality homepage** with full DSL attribution in packet `citations` and
   artifact `humanCitation` strings.
2. **Use artifact refs** (`artifactClass: cartographic_grade_map`) — not live GeoJSON layers or
   grade-share observations sourced from DSL polygons on anon surfaces.
3. **Keep `method_stance: juxtaposition`** unless a gated causal claim is explicitly cleared.
4. **Label uncertainty** where modern boundaries differ from 1935–1940 survey footprints.

### Required attribution string (public copy)

> Mapping Inequality: Redlining in New Deal America, Digital Scholarship Lab, University of
> Richmond, https://dsl.richmond.edu/panorama/redlining/. Underlying HOLC maps: U.S. National
> Archives and Records Administration (public domain). Georectified vector data © University
> of Richmond, licensed CC BY-NC-SA 4.0 (noncommercial).

Adapt tense and punctuation for UI footers; preserve custodian, homepage URL, NARA PD layer,
and NC-SA posture.

### Example packet artifact shape

Public packets reference a **cartographic cite artifact**, not stored geometry:

```json
{
  "id": "holc-map-chicago",
  "title": "Chicago HOLC security map",
  "artifactClass": "cartographic_grade_map",
  "dateLabel": "circa 1940",
  "summary": "Color-coded residential security map for Chicago neighborhoods surveyed by HOLC.",
  "uncertaintyLabel": "Survey boundaries reflect 1935–1940 footprints; modern streets and jurisdictions differ.",
  "provenance": {
    "source": "mapping-inequality-holc",
    "source_url": "https://dsl.richmond.edu/panorama/redlining/",
    "retrieved_at": "2026-07-22T00:00:00Z",
    "content_hash": "sha256:<fixture-or-capture-hash-at-publish>",
    "humanCitation": "Mapping Inequality: Redlining in New Deal America, Digital Scholarship Lab, University of Richmond, https://dsl.richmond.edu/panorama/redlining/ (CC BY-NC-SA 4.0 on vector derivatives; NARA source scans public domain)."
  }
}
```

**Do not** populate public `observation_refs` from `holc-grade-area-share-city` or other
polygon-derived metrics until observations exist under an explicit ingestion bead **and** rights
review clears the target surface. Until then, list proposed metrics in `gap_states.missing_series`.

## 5. Gate 2 checklist (ingestion + evidence)

| Check | Pilot posture |
|-------|---------------|
| Rights reviewed for public surface | **Cite-only** — NC geometry stays staff-only |
| `mapping-inequality-holc` registry | Remains `disabled`; verdict `noncommercial` |
| HOLC observations on anon surfaces | **No** — fixtures use citation artifacts only |
| Staff polygon inventory | Present in `bb_reference.holc_areas` (703 Chicago rows) |
| Public homepage link | Required in every HOLC artifact / citation footer |
| Commercial / revenue-bearing reuse of DSL GeoJSON | Blocked pending separate rights review |

## 6. References

- [Mapping Inequality — Redlining in New Deal America](https://dsl.richmond.edu/panorama/redlining/)
- `packages/domain/src/external-data-sources.ts` — `mapping-inequality-holc`
- `packages/domain/src/launch-corpora.ts` — corpus rights notes
- `supabase/migrations/20260720220009_reference_stats.sql` — `holc_areas` DDL
- `supabase/migrations/20260720220010_rls_policies.sql` — staff-only RLS
- [theme-impact-canonical-questions.md](./theme-impact-canonical-questions.md) — Q2/Q4 artifact classes

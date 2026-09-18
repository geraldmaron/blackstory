<!--
  Gap inventory and sourcing ladder for Lives Across the Decades. Companion to
  lives-regions-and-sources.md (plan of record) and lives-across-decades.md (binding method).
-->

# Lives: remaining gaps and how to fill them

**Status:** Working research note
**Date:** 2026-09-16 (updated after HC(1)-A rent load + Alabama PC(1)-C pass)
**Epic:** `repo-0clax`

## What “empty” actually is

| Symptom | Cause | Fix |
|---|---|---|
| Unhatched street layers | Cells in `pending` (published table not loaded) or `not_measured` (census never published) | Finish NHGIS / double-entry transcription; leave `not_measured` alone |
| Twelve dashed world cards | Authored beats only for sparse decades; auto gaps fill the rest | Author sparse high-quality beats; do not invent thin copy for every domain |
| Region feels like one city | Place anchors were documented but not implemented; street is one SVG with a seed | Ship **2–3 place anchors per region** as illustration chips, never as city rates |
| Soft national money captions on regional pages | Dollar fixtures are national-only until snapshots carry the same rows | Prefer snapshot dollars; keep fixtures only as a caption bridge |

Scholarship (Collins–Margo, Margo schooling, IPUMS reconstructions) is a **bibliography and finding aid**, not a cell source. National-only microdata series and non-census universes are declined for figures. See [lives-source-scholarship-assessment.md](./lives-source-scholarship-assessment.md).

## Sourcing ladder (highest yield first)

1. **NHGIS published tables already coded** in `LIVES_HISTORICAL_MEASURES` / decennial / ACS.
2. **Double-entry transcription** of print volumes (urban remainder, occupation class, 1940–60 income/HS/unemp, White early urban). Path: `load-lives-transcribed.ts`.
3. **Federal non-Census statistical volumes** (Bureau of Education spending, etc.) when the method already allows the publisher.
4. **World beats + catalog off-ramps** (laws, stories, books, Data spines, theme-impact) labeled `factual` / `testimony` / `insufficient_evidence` / `modeled`.
5. **Never:** IPUMS microdata as Lives figures; HOLC / metro packets as region rates; crime heat; CPI-deflated modern sticker prices.

## Highest-yield empty cells (build work)

| Gap | Decade | Lens | Path |
|---|---|---|---|
| Work-based class | 1870–1930 | Black, white | Occupation volumes (`.26`) |
| Urban | 1920–1960 | Black, white | Print + NHGIS map |
| White urban | 1890–1900 | White | Table 42 (`.38`) |
| Mid-century income / HS / unemp | 1940–1960 | Black, white, proxies | 1960 PC(1)-C Tables 47/53/65; **AL MS MD TX IL CA loaded**; remaining states `repo-0clax.43` (see `lives-1960-pc1c-chapter-c-paths.md`) |

| Homeownership | 1950–1960 | Black, white | Print |
| 1970 same-year rent for affordance | 1970 | Black, Total | **Loaded** HC(1)-A Tables 1/6 (`repo-0clax.41` closed). White median still missing (`repo-0clax.42`) |
| Work-class stub map | 1870–1930 | — | Binding map in `lives-occupation-class-map.md`; counts still pending (`repo-0clax.40`) |

## Context without inventing rates

- **Place anchors:** two or three complementary places per region (rural + industrial + later migration). Figures stay regional.
- **Testimony:** named speakers with `speakerPlaceMismatch` when the place is outside the selected region.
- **Insufficient evidence beats:** justice and health stay national off-ramps.
- **Modeled affordance:** only same-year income + rent/value; work-based decades refuse.

## Prune

- Microdata OCC1950 strata removed 2026-09-16 (`strata.ts`); published-table class remains the path (bead `.28`).
- Dual national dollar fixtures when snapshots carry the same rows.
- Theme-impact “one metro pilot” language must not leak into Lives region math.

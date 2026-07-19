# Census population comparability

How BlackStory treats decennial Black-population counts across decades: what we ingest today,
what NHGIS will add, and what we deliberately do not invent.

## Sources

| Era | Custodian | Acquisition | BlackStory status |
| --- | --- | --- | --- |
| 2000–2020 county decennial | U.S. Census Bureau | `api.census.gov` (`census-demographics` adapter) | Ingested for 2000, 2010, 2020 SF1/PL alone tables |
| 1790–1990 county decennial | IPUMS NHGIS (University of Minnesota) | IPUMS API / NHGIS extracts (`external-data:nhgis-county-race`) | Registered, **disabled** — blocked on human `NHGIS_API_KEY` |
| County boundary stability | U.S. Census Bureau | Substantial county changes lists | Documented in `@repo/domain` `COUNTY_FIPS_CHANGES` |

Modern pulls use the Census Data API with a caller-supplied `CENSUS_API_KEY`. Historical spans
require NHGIS time-series tables plus explicit crosswalks — not label matching alone.

## What we provide

- **Category documentation** — `packages/domain/src/demographics/comparability.ts` defines
  `DecadeComparabilityBand`, decade race labels, and `COMPARABILITY_NOTE_2000_2020` for UI and
  Firestore disclaimers.
- **Modern alone-comparable trio** — 2000, 2010, and 2020 use Census "Black or African American
  alone" one-race tables. National rollups on the Data page aggregate ingested county rows for
  these decades only (via `@repo/firebase` national-stats readers).
- **Boundary caution** — `BOUNDARY_CHANGE_CAUTION` and `COUNTY_FIPS_CHANGES` warn that FIPS
  renames, merges, and Connecticut's 2022 planning-region switch invalidate naive same-code
  decade deltas.

## What we do not invent

- **Harmonized pre-2000 totals** — Enslaved/free colored, Negro, and Black categories differ by
  decade and statutory schedule. BlackStory does not synthesize a continuous 1790–2020 series on
  the public Data page.
- **Boundary-stable deltas without crosswalks** — Subtracting county counts across decades at
  the same FIPS code without NHGIS/Census crosswalks is out of scope until ingestion beads land.
- **ACS metric rollups on `/data`** — ACS starter estimate fields are ingested for map/modeling;
  the Data page ACS section shows **coverage counts only** until income/education/housing rollups
  ship (see `apps/web/src/app/data/page.tsx`).

## Operator checklist (NHGIS historical)

1. Complete the human gate: register IPUMS NHGIS account and store `NHGIS_API_KEY` (Secret Manager /
   env pattern — never commit).
2. Enable `external-data:nhgis-county-race` when the key is live.
3. Prefer NHGIS **time-series tables** + **geographic crosswalks** over raw decade extracts when
   computing county Δ across boundary changes.
4. Widen `censusCountyDecadeDecadeSchema` only when a pre-2000 vintage is actually loaded with
   provenance; empty decades stay empty (no synthetic fill).

## Explore map population index

County choropleths on Explore load `/geo/county-population-decades.json` (compact fips5 → decade →
counts). Regenerate from Admin SDK export of `censusCountyDecades` — do not full-scan Firestore in
the browser. The checked-in file may be a small real-shaped sample until a full export is published.


1. Confirm registry entry `nhgis-county-race` in `external-data-sources.ts` (`registryState:
   disabled`).
2. Register for IPUMS NHGIS and store `NHGIS_API_KEY` via Secret Manager / `run-with-dev-secrets`
   — never commit the key.
3. Implement live extract in `packages/domain/src/adapters/nhgis/` (scaffold throws until then).
4. Archive raw NHGIS extract + checksum per [data-ingestion-methodology.md](./data-ingestion-methodology.md).
5. Attach `COMPARABILITY_NOTE_2000_2020` (or era-specific notes) on any new public surface that
   spans pre-2000 and post-2000 decades.

## Related modules

- `packages/domain/src/external-data-sources.ts` — acquisition registry
- `packages/domain/src/demographics/comparability.ts` — comparability matrix
- `packages/domain/src/geography/county-fips-changes.ts` — FIPS transition edges
- `packages/domain/src/adapters/census-demographics/` — live 2000–2020 pulls
- `packages/domain/src/adapters/nhgis/` — NHGIS scaffold (API key gate)

<!--
  How to seed bb_reference.jurisdictions (state/county FIPS) for geo joins and
  statistical_observations.FK. Coarse bbox polygons already supported by
  20260721180100_jurisdictions_geography.sql until full TIGER load.
-->

# Load reference jurisdictions

**Why:** Production had `bb_reference.jurisdictions` empty — geo-integrity and
`statistical_observations.jurisdiction_id` FKs cannot work without this hierarchy.

**Ids:** Use stable text PKs:

| Kind | Id pattern | Example |
|------|------------|---------|
| nation | `nation:US` | United States |
| state | `state:{stateFips}` | `state:24` (Maryland) |
| county | `county:{stateFips}{countyFips}` | `county:24031` (Montgomery County, MD) |

## Recommended load path

1. **Nation + states (52 rows):** `packages/firebase/scripts/load-reference-jurisdictions.ts`
2. **Counties (~3,144 in-scope):** `packages/firebase/scripts/load-reference-counties.ts`
   - Source: [Census Bureau 2024 national county Gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip) (public domain)
   - Parser: `packages/firebase/src/jurisdictions/tiger-gazetteer.ts`
   - Product scope: 50 states + D.C. (territory counties are parsed but excluded)
3. Optional later: attach `location` geography from TIGER polygons (or keep coarse bbox until TIGER bead lands).

## State / nation loader

Dry-run (default):

```bash
node --conditions development --import tsx packages/firebase/scripts/load-reference-jurisdictions.ts
```

Apply:

```bash
DRY_RUN=0 LOAD_JURISDICTIONS_APPLY=1 DATABASE_URL=postgresql://… \
  node --conditions development --import tsx packages/firebase/scripts/load-reference-jurisdictions.ts
```

## County loader

Dry-run downloads the Gazetteer zip (or pass a local file):

```bash
node --conditions development --import tsx packages/firebase/scripts/load-reference-counties.ts

# offline / pinned file
node --conditions development --import tsx packages/firebase/scripts/load-reference-counties.ts \
  --gazetteer-file=/path/to/2024_Gaz_counties_national.txt
```

Apply (run state loader first — `parent_id` FK):

```bash
DRY_RUN=0 LOAD_JURISDICTIONS_APPLY=1 DATABASE_URL=postgresql://… \
  node --conditions development --import tsx packages/firebase/scripts/load-reference-counties.ts
```

Apply output includes `contentHash` (SHA-256 of source bytes) and provenance
(`source`, `sourceUrl`, `retrievedAt`) stored on each county row's `metadata` jsonb.

## Minimal seed (Phase 1 fixtures)

The Phase 1 indicator fixture includes a small jurisdiction set (`nation:US`, selected states/counties) so observation upserts succeed in dry-run and local Postgres without a full Gazetteer load. Expand via the loaders before production indicator ingest.

## Verification

```sql
SELECT kind, count(*) FROM bb_reference.jurisdictions GROUP BY kind ORDER BY 1;
-- expect: nation ≥ 1, state = 51 (50 states + DC), county ≥ 3,000
```

Spot-check hierarchy:

```sql
SELECT id, parent_id, state_fips, county_fips
FROM bb_reference.jurisdictions
WHERE id IN ('county:24031', 'state:24', 'nation:US');
```

## Statistical tables prerequisite

Phase 1 indicator ingest (`ingest-phase1-indicators.ts`) requires
`bb_reference.statistical_series` / `statistical_observations` (migration
`20260721220000_statistical_series_observations.sql`). As of 2026-07-21 this migration is
**not yet applied** on remote `blackstory-app` (latest remote: `20260721204528_landscape_candidates`).

Apply locally or to linked project:

```bash
# from repo root — linked Supabase project
supabase db push

# or apply one migration via psql
psql "$DATABASE_URL" -f supabase/migrations/20260721220000_statistical_series_observations.sql
```

Then load jurisdictions, then (optional) apply fixture:

```bash
node --conditions development --import tsx packages/firebase/scripts/load-reference-jurisdictions.ts
DRY_RUN=0 LOAD_JURISDICTIONS_APPLY=1 DATABASE_URL=… \
  node --conditions development --import tsx packages/firebase/scripts/load-reference-counties.ts
INGEST_PHASE1_INDICATORS_APPLY=1 DRY_RUN=0 DATABASE_URL=… \
  node --conditions development --import tsx packages/firebase/scripts/ingest-phase1-indicators.ts
BUILD_PHASE1_COVERAGE_APPLY=1 DRY_RUN=0 DATABASE_URL=… \
  node --conditions development --import tsx packages/firebase/scripts/build-phase1-indicator-coverage-snapshot.ts
```

The coverage snapshot upserts `bb_public.materialized_snapshots` key `phase1IndicatorCoverage`
(observation + series counts) so `/data` reads `sampleObservationCount` via a point-get.

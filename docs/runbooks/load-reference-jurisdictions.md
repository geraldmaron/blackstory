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

1. Download Census TIGER/Line state and county national files (public domain).
2. Run `packages/firebase/scripts/load-reference-jurisdictions.ts` (upsert by id; provenance quartet on metadata).
3. Optional: attach `location` geography from TIGER polygons (or keep coarse bbox until TIGER bead lands).

## Minimal seed (Phase 1 fixtures)

The Phase 1 indicator fixture includes a small jurisdiction set (`nation:US`, selected states/counties) so observation upserts succeed in dry-run and local Postgres without a full TIGER load. Expand via the loader before production indicator ingest.

## Verification

```sql
SELECT kind, count(*) FROM bb_reference.jurisdictions GROUP BY kind ORDER BY 1;
-- expect: nation ≥ 1, state = 51+ (states + DC/PR as product requires), county ≈ 3,000+
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
INGEST_PHASE1_INDICATORS_APPLY=1 DRY_RUN=0 DATABASE_URL=… \
  node --conditions development --import tsx packages/firebase/scripts/ingest-phase1-indicators.ts
```

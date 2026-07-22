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

# Geo-integrity publish gate

**Workstream:** WS2 (`repo-2ztn.3`) — PostGIS jurisdiction load + publish geo-integrity gate  
**Branch:** `research/data-landscape-capitalization`

## Problem

`bb_reference.jurisdictions` is empty (0 rows). Entity locations can carry a declared state code that does not match their WGS84 coordinates. Without a structural containment check, wrong-state tags can reach public release.

## Target behavior

1. Load state boundary polygons into reference storage (PostGIS `geography` when applied; fixture JSON for now).
2. **Fail-closed publish gate:** block release when `(lat, lng)` is not inside the polygon for the declared `stateCode`.
3. **Audit API:** given `[{ id, stateCode, lat, lng }]`, return mismatches only — no silent auto-rewrite.

## Domain module

Pure functions live in `packages/domain/src/geo-integrity/`:

| Export | Role |
|---|---|
| `pointInPolygonRings` | Ray-cast + small boundary tolerance |
| `evaluateStateContainment` | Declared state vs point; optional inferred state for audit |
| `auditEntityStateContainment` | Batch mismatch inventory |
| `evaluateGeoIntegrityPublishGate` / `assertGeoIntegrityPublishGate` | Release pipeline gate |

Fixture polygons (MA, NY, NJ simplified rectangles) back unit tests:

- Boston-ish MA point tagged `MA` → pass
- Harlem-ish NY point tagged `NJ` → fail (inferred `NY`)

The loader fixture (`state-jurisdictions.fixture.json`) covers all **51** jurisdictions (50 states + D.C.) with coarse bbox rectangles derived from `US_STATES` in `packages/domain/src/map/us-geography.ts`. Same simplified shape is mirrored in `scripts/fixtures/us-states-simplified.geojson` for optional GeoJSON inspection.

## Loader script (validate / emit SQL only)

```bash
# Default: validate fixture (51 rows, closed rings, unique FIPS/postal codes)
node scripts/load-state-jurisdictions.mjs
node scripts/load-state-jurisdictions.mjs --dry-run

# Emit operator-reviewed upsert SQL (stdout)
node scripts/load-state-jurisdictions.mjs --emit-sql > jurisdictions-state-load.sql

# Or write directly to a file
node scripts/load-state-jurisdictions.mjs --emit-sql --output jurisdictions-state-load.sql
```

The default fixture matches the conceptual shape of `bb_reference.jurisdictions` rows:

- `id`: `us-{stateFips}` (ADR-016)
- `kind`: `state`
- `parent_id`: `us`
- `metadata.geometry`: GeoJSON `Polygon` (coarse bbox rectangle)
- `metadata.postalCode`: USPS code (`MA`, `NY`, `DC`, …)

### Apply path (operator-only)

1. Apply schema migration `supabase/migrations/20260721180100_jurisdictions_geography.sql` (adds `location geography(Polygon, 4326)` + GiST index).
2. Review generated SQL from `--emit-sql`.
3. Apply with `psql` against the intended database — **not** from this script:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f jurisdictions-state-load.sql
```

`--apply` is gated behind `LOAD_JURISDICTIONS_APPLY=1` and still **only emits SQL**; it never opens a Supabase/Postgres connection from agent or CI sessions:

```bash
LOAD_JURISDICTIONS_APPLY=1 node scripts/load-state-jurisdictions.mjs --apply --output jurisdictions-state-load.sql
# then psql manually as above
```

Without `LOAD_JURISDICTIONS_APPLY=1`, `--apply` exits with code 2.

## Wiring (follow-up)

1. Parent merges barrel: `export * from './geo-integrity/index.js'` in `packages/domain/src/index.ts`.
2. Release/projection pipeline calls `assertGeoIntegrityPublishGate` with entity rows + boundary index loaded from `bb_reference.jurisdictions` (or PostGIS `ST_Contains` equivalent in SQL).
3. One-off mismatch inventory: run `auditEntityStateContainment` over existing release entities; human correction only.

## Tests

```bash
node --conditions development --import tsx --test packages/domain/src/geo-integrity/geo-integrity.test.ts
node scripts/load-state-jurisdictions.mjs --dry-run
node scripts/load-state-jurisdictions.mjs --emit-sql | head
```

## Non-goals

- Auto-correcting production entity coordinates or state tags.
- Live Supabase apply from agent sessions.
- Survey-grade TIGER boundaries in fixtures (real load uses Census-derived polygons later).

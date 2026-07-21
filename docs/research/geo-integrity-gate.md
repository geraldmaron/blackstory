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

## Loader script (dry-run only)

```bash
node scripts/load-state-jurisdictions.mjs --dry-run
node scripts/load-state-jurisdictions.mjs --fixture packages/domain/src/geo-integrity/fixtures/state-jurisdictions.fixture.json
```

The default fixture matches the conceptual shape of `bb_reference.jurisdictions` rows:

- `id`: `us-{stateFips}` (ADR-016)
- `kind`: `state`
- `parent_id`: `us`
- `metadata.geometry`: GeoJSON `Polygon` for future `ST_GeogFromGeoJSON`

`--apply` is **blocked** in this script. Operator applies to Supabase after human review; this bead does not live-write production.

## Wiring (follow-up)

1. Parent merges barrel: `export * from './geo-integrity/index.js'` in `packages/domain/src/index.ts`.
2. Release/projection pipeline calls `assertGeoIntegrityPublishGate` with entity rows + boundary index loaded from `bb_reference.jurisdictions` (or PostGIS `ST_Contains` equivalent in SQL).
3. One-off mismatch inventory: run `auditEntityStateContainment` over existing release entities; human correction only.

## Tests

```bash
node --conditions development --import tsx --test packages/domain/src/geo-integrity/geo-integrity.test.ts
node scripts/load-state-jurisdictions.mjs --dry-run
```

## Non-goals

- Auto-correcting production entity coordinates or state tags.
- Live Supabase apply from agent sessions.
- Survey-grade TIGER boundaries in fixtures (real load uses Census-derived polygons later).

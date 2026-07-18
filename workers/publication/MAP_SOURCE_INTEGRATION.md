# Map source: release-activation integration point (BB-070)

This file documents where the map data platform (`packages/domain/src/map/`,
BB-070) plugs into release activation, once that pipeline exists. It is
**not wired live** — this is a TODO with an exact call site, added
deliberately instead of leaving the map-source builder as code nobody would
ever invoke. See `docs/adr/ADR-013-map-stack.md` ("Release-coupled build")
for the full rationale.

## Why nothing was wired here

As of this writing, no release-activation pipeline exists in any language
that iterates every active public projection and calls
`toPublicEntityProjection` (or the equivalent) end to end — `release.py` in
this package currently only has deterministic manifest/hashing helpers
(`build_manifest_entry`, `canonical_json`, `sha256_json`), not an
entity-iteration/publish loop. Wiring the map-source build against a
pipeline that doesn't exist yet would mean guessing at an interface, with
real risk of drifting from whatever the actual implementation turns out to
be. The map-source builder (`buildMapSource` in
`packages/domain/src/map/map-source.ts`) is a complete, tested, pure
function ready to be called the moment that pipeline lands.

## Exact call site, once release activation exists

1. Wherever the pipeline builds a `ReleaseArtifact` per entity (TypeScript
   equivalent: `buildReleaseManifest` in
   `packages/domain/src/publication/index.ts`; this Python package's
   `build_manifest_entry` is the same hashing step for one entity), also
   collect that entity's location into a `MapSourceEntityInput`:
   `{ entityId, kind, displayName, livingStatus, location: { precision, lat,
   lng, geohash, matchMethod, ... } }` — the raw (pre-redaction) values, the
   same inputs `redactLocationForPublic` normally takes.
2. Call, once per release, in TypeScript:

   ```ts
   import { buildMapSource } from '@blap/domain';
   import { redactLocationForPublic } from '@blap/security';

   const mapSource = buildMapSource({
     releaseId,
     generatedAt,
     entities, // every active entity, with or without a location
     redactLocation: redactLocationForPublic,
   });
   ```

   `buildMapSource` skips entities with no `location` and never reads a raw
   coordinate for output — every coordinate in `mapSource` is the return
   value of `redactLocationForPublic`. See
   `packages/domain/src/map/map-source.redaction.test.ts` for the regression
   test proving this against a precise living-person residential coordinate.

3. Persist three release-scoped artifacts, mirroring the existing
   `publicEntitySnapshotPath` layout:
   - `public/releases/{releaseId}/map/source.json` — `mapSource.featureCollection`
   - `public/releases/{releaseId}/map/state-aggregates.json` — `mapSource.stateAggregates`
   - `public/releases/{releaseId}/map/county-aggregates.json` — `mapSource.countyAggregates`

4. Hash each with `sha256Json` (TypeScript) / `sha256_json` (this package)
   and add matching entries to the signed release manifest, the same way
   entity projections and snapshots are hashed today — so manifest
   verification and rollback cover the map artifacts exactly like every
   other release-scoped artifact. No new rollback code is needed: switching
   the active-release pointer already restores the prior map version the
   same way it restores the prior search-index version (ADR-004).

## Standing in for this today

`packages/domain/src/map/generate-demo-map-source.ts` performs the same
sequence (steps 1–2 above) against fixture data, once, to produce the static
artifact the `/map` demo route (`apps/web/src/app/map/`) reads. It is the
exact shape of call the real integration will make.

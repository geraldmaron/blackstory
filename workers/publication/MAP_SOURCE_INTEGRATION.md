# Map source: release-activation integration point (BB-070)

This file documents where the map data platform (`packages/domain/src/map/`,
BB-070) plugs into release activation. The call site below is now implemented
in TypeScript and is still **not called by anything that runs in production**,
so the file remains a TODO with an exact target rather than a description of
live behavior. See `docs/decisions-carryover.md` ("Map stack": release-coupled
build) for the full rationale; the ADR this file used to cite,
`docs/adr/ADR-013-map-stack.md`, was deleted in the 2026-07-24 `docs/adr/`
purge and its content lives in that carryover section now.

## Why nothing was wired here (historical, and how it stands today)

When this file was written, no release-activation pipeline existed in any
language that iterates every active public projection and calls
`toPublicEntityProjection` (or the equivalent) end to end: `release.py` in this
package had only deterministic manifest/hashing helpers
(`build_manifest_entry`, `canonical_json`, `sha256_json`), not an
entity-iteration/publish loop. Wiring the map-source build against a pipeline
that did not exist would have meant guessing at an interface.

That gap is closed on the TypeScript side. `generateReleaseArtifacts` in
`packages/domain/src/publication/release-activation.ts` (MOB-005) performs
steps 1 through 4 below: it builds the map source and the state/county
aggregates through `buildMapSource`, hashes and canonicalizes every artifact,
persists them content-addressed and immutably, and activates by flipping one
pointer under compare-and-set.

What is still missing is a caller. `generateReleaseArtifacts` and
`activateRelease` have no caller outside `release-activation.test.ts` and
`release-evidence.test.ts`, and the publisher that actually runs,
`packages/ops-data/scripts/publish-release-catalog-artifacts.ts`, emits
`entities.json` and `search-index.json` and no map artifact at all. Nothing
reads `public/releases/{releaseId}/map/source.json`. So the outcome this file
describes is unchanged; only the reason for it has moved, from "the pipeline
does not exist" to "the pipeline exists and nothing invokes it."

## Exact call site

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
   import { buildMapSource } from '@repo/domain';
   import { redactLocationForPublic } from '@repo/security';

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
   same way it restores the prior search-index version (see
   `docs/decisions-carryover.md`, "Public projection and immutable
   publication snapshots").

## What exercises this sequence today

`packages/domain/src/map/generate-demo-map-source.ts` used to stand in here: a
one-off script that ran steps 1 and 2 against fixture data to write a static
`map-source.seed.json` for the `/map` demo route. That script was retired on
2026-09-13 (repo-uogug). The demo route is gone (`apps/web/src/app/map/` now
holds Explore's style and layer-id modules, no `page.tsx`), so the script wrote
an artifact nothing read.

The sequence is covered without it. `release-activation.test.ts` drives
`generateReleaseArtifacts` over `MAP_SOURCE_DEMO_FIXTURES`, and three live
callers inject the real `redactLocationForPublic` at their own layer: web
Explore (`buildExploreMapSource` in
`apps/web/src/lib/map-experience/build-explore-map-source.ts`), `api-public`'s
`GET /v1/map` (`apps/api-public/src/http/build-map-source-v1.ts`), and the
release-activation state machine itself.

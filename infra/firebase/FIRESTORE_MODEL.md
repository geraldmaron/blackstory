/**
 * Firestore data model (BB-013 foundation, BB-014 entity/geography depth)
 *
 * Foundation for Black Book structured data under ADR-011 / D-014. Privileged writes use the Admin SDK from Cloud Run / workers with distinct service accounts. Browser clients only read public projections and create quarantine submissions.
 *
 * Document paths always use even segment counts (`collection/doc` or `collection/doc/collection/doc`).
 */

## Root collections

| Collection | Purpose | Client read | Client write |
|------------|---------|-------------|--------------|
| `policy` | Active policy pointer (`policy/active`) | Yes | No |
| `policyVersions` | Constitution version metadata | Yes | No |
| `researchCases` | Research workspace | Staff `research`/`admin` | No |
| `canonicalEntities` | Canonical entities (kinds, aliases, identifiers, kind payloads, merge state) | No | No |
| `canonicalEntities/{id}/locations/{id}` | Historical **and** current locations (geometries + optional geohash point) | No | No |
| `canonicalClaims` | Canonical claims | No | No |
| `entityRelationships` | Relationships with evidence + temporal/geographic context | No | No |
| `entityMerges` | Reversible, audited duplicate merges | No | No |
| `evidenceRecords` / `evidenceSources` | Evidence metadata (blobs in Storage/GCS) | No | No |
| `publicationReleases` | Release manifests / drafts | `publication`/`admin` | No |
| `publicMeta` | Active release pointer | Yes | No |
| `publicReleases/{id}/entities/{id}` | Released projections | Yes | No |
| `publicSearchIndex` | Search/geo index docs (geohash) | Yes | No |
| `submissionInbox` | Quarantine inbox | Own docs or security/admin | Create quarantined only |
| `auditEvents` | Append-only audit | No | No |
| `killSwitches` | Ops kill switches | `admin` | No |

## Entity kinds (BB-014)

`person` · `place` · `school` · `organization` · `institution` · `event` · `law` · `case` · `publication` · `artifact` · `other`

Typed domain models live in `@black-book/domain`. Firestore Zod converters live in `@black-book/firebase`.

## Geography without PostGIS

- Store Firestore-friendly geometries: `Point`, `Polygon`, or `BBox` on location docs.
- Public projection and search-index documents may include `lat`, `lng`, `geohash`, optional `geohashPrefixes`, plus `precision` and `matchMethod`.
- `@black-book/domain` provides `encodeGeohash` / `buildGeoPointFields` / `haversineMeters`.
- `api-public` performs approved geohash-bounded queries plus server-side radius filtering (ADR-008 / ADR-011).
- **ZIP** is `modern_input` / `modern_lookup` only — never a permanent historical boundary.
- Historical and current `locations` subdocs may coexist on the same entity.
- Geographic matches record `method` + constitution-aligned `precision`.

## Merge lineage

`entityMerges/{id}` records survivor/absorbed ids, evidence, and audit event ids. Status is `active` or `reversed` so merges are reversible and audited. Absorbed entities carry `mergeState.status = merged_away`.

## Living status

Unknown living status defaults to `unknown` and is treated as living at the model layer (`@black-book/domain` / constitution). BB-015 hardens enforcement further.

## Auth claims

Custom claims (minted by privileged backend; BB-027): `admin` / `research` / `publication` / `security` booleans and/or `bb_role`. Research never authorizes publish.

## Code

| Artifact | Location |
|----------|----------|
| Security rules | `infra/firebase/firestore.rules` |
| Indexes | `infra/firebase/firestore.indexes.json` |
| Domain types / geohash / merge | `@black-book/domain` |
| Paths / types / converters | `@black-book/firebase` → `src/firestore/` |
| Seed fixtures | `packages/firebase/fixtures/firestore-seed.ts` |
| Server publish guards | `@black-book/data-access` → `src/firestore/` |

## Emulator tests

```bash
pnpm firebase:emulators
# other terminal
CI_REQUIRE_FIREBASE=1 pnpm --filter @black-book/firebase test
```

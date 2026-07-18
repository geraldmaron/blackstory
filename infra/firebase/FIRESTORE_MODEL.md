/**
 * Firestore data model (BB-013 foundation through BB-018 audit/outbox)
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
| `canonicalClaims` | Atomic claims with versions, confidence, measurements (BB-017) | No | No |
| `claimEvidenceLinks` | Claim↔evidence roles: supporting / contradicting / contextual (BB-017) | No | No |
| `entityRelationships` | Relationships with evidence + temporal/geographic context | No | No |
| `entityMerges` | Reversible, audited duplicate merges | No | No |
| `sourceOrganizations` | Source organizations (BB-016) | No | No |
| `sourceDomains` | Hostnames tied to organizations (BB-016) | No | No |
| `evidenceSources` | Source adapters, policies, rights defaults, adapter kill flag (BB-016) | No | No |
| `sourceItems` | Stable source item identifiers (BB-016) | No | No |
| `sourceCaptures` | Captures with content hashes, parser versions, selective snapshots (BB-016) | No | No |
| `retrievalEvents` | Retrieval / fetch attempts (BB-016) | No | No |
| `evidenceRecords` | Evidence metadata (blobs in Storage/GCS); must reference `sourceItemId` | No | No |
| `evidenceLineage` | Syndication / republication relationships (BB-016) | No | No |
| `publicationReleases` | Release manifests / drafts | `publication`/`admin` | No |
| `publicMeta` | Active release pointer | Yes | No |
| `publicReleases/{id}/entities/{id}` | Released projections | Yes | No |
| `publicSearchIndex` | Search/geo index docs (geohash) | Yes | No |
| `submissionInbox` | Quarantine inbox | Own docs or security/admin | Create quarantined only |
| `auditEvents` | Append-only audit (BB-018) | Admin/security read; trusted staff append | Create only |
| `outboxMessages` | Transactional event delivery with retry/DLQ (BB-018) | No | No |
| `idempotencyKeys` | State-change replay guard (BB-018) | No | No |
| `outboxConsumerReceipts` | Per-consumer effect deduplication (BB-018) | No | No |
| `killSwitches` | Ops kill switches (including `source-adapter-{adapterId}`) | `admin` | No |

## Entity kinds (BB-014)

`person` · `place` · `school` · `organization` · `institution` · `event` · `law` · `case` · `publication` · `artifact` · `other`

Typed domain models live in `@blap/domain`. Firestore Zod converters live in `@blap/firebase`.

## Claims, contradictions, and confidence (BB-017)

- **Atomic claims** store predicate/object, claim class (`standard` | `high_impact`), workflow + publication status, procedural status, and temporal/geographic context.
- **Versions** are retained on the claim (`versions[]` + `currentVersionId`).
- **`claimEvidenceLinks`** bind evidence with role `supporting` | `contradicting` | `contextual`, plus quality inputs and `lineageRootId` (from BB-016).
- **Confidence** is calculated by deterministic code in `@blap/domain` (`calculateClaimConfidence`). Scores retain component values and constitution `policyVersion`.
- **Syndication:** when constitution `blockSyndicatedCopiesAsIndependent` is true, evidence sharing a `lineageRootId` counts as one independent lineage.
- **Contradictions:** credible alternate values are preserved in `preservedValues` (never silently collapsed).
- **Publication:** high-impact claims use the higher constitution threshold; narratives cannot cite unpublished claims (`assertNarrativeMayCiteClaim`).
- Relevance, connection strength, and research coverage are stored as distinct measurements (not conflated with confidence).

## Append-only audit and transactional outbox (BB-018)

- `commitWithAudit` runs a Firestore transaction that checks `idempotencyKeys/{key}`, applies the state mutations, and creates the audit event, pending outbox message, and idempotency record as one atomic commit.
- Audit actions use a controlled vocabulary across policy, source, research, moderation, publication, correction, retraction, authentication, and administrative categories.
- Every audit event records actor, reason, request, release (when applicable), correlation, subject, entity, and idempotency identifiers.
- Client rules permit trusted staff to create strictly validated user-attributed audit events. Updates and deletes are always denied. Server helpers use transaction `create`, never set/update, for audit records.
- `consumeOutboxMessage` gives an in-process worker hook with bounded exponential retry and terminal `dead_letter` state. Its handler may stage Firestore writes only; a consumer receipt and those effects commit atomically, so replay does not duplicate Firestore effects.
- External side effects are intentionally not claimed as exactly-once. A later Cloud Tasks adapter must pass the event id as the downstream idempotency key.
- Publication history is reconstructed from all entity-scoped publication, correction, and retraction audit events, ordered by `occurredAt` and event id.
- Production Firestore is not enabled, so the repository targets the emulator/standard Native-mode contract; edition verification remains a deployment prerequisite.

## Sources, captures, rights, and provenance (BB-016)

- **Source organizations / domains** register who hosts material and which hostnames belong to them.
- **`evidenceSources`** are adapters with constitution `sourceClassifications`, selective snapshot policy (`none` | `selective` — never automatic full crawl), default rights / publication permissions / prohibited uses, and `adapterEnabled`.
- **Kill switches:** `adapterEnabled: false` OR engaged `killSwitches/source-adapter-{adapterId}` blocks new candidates via `canSourceAdapterCreateCandidates` / `assertSourceAdapterCanCreateCandidates` in `@blap/domain`. Clients cannot write these collections.
- **Source items** carry stable identifiers within the source scheme; every **evidence record** requires `sourceItemId`.
- **Captures** store `contentHash` (`sha256` hex), `parserVersion`, optional selective `snapshotStorageObject`, and `dedupOfCaptureId` when hash-deduplicated.
- **Evidence** stores locator (page/pages/offsets), excerpt + `excerptKind`, `observedAt`, `rightsStatus`, permissions, prohibited uses, and optional syndication pointers (`lineageRootId`, `syndicatedFromEvidenceId`).
- **Rights gate:** `assertRightsStatusForPublication` / `assertEvidenceMayPublish` require resolved rights before publishing **media** or **substantial excerpts** (constitution `publicationRestrictions.requireRightsStatus`).
- Blobs remain in Storage/GCS; Firestore holds metadata only.

## Geography without PostGIS

- Store Firestore-friendly geometries: `Point`, `Polygon`, or `BBox` on location docs.
- Public projection and search-index documents may include `lat`, `lng`, `geohash`, optional `geohashPrefixes`, plus `precision` and `matchMethod`.
- `@blap/domain` provides `encodeGeohash` / `buildGeoPointFields` / `haversineMeters`.
- `api-public` performs approved geohash-bounded queries plus server-side radius filtering (ADR-008 / ADR-011).
- **ZIP** is `modern_input` / `modern_lookup` only — never a permanent historical boundary.
- Historical and current `locations` subdocs may coexist on the same entity.
- Geographic matches record `method` + constitution-aligned `precision`.

## Merge lineage

`entityMerges/{id}` records survivor/absorbed ids, evidence, and audit event ids. Status is `active` or `reversed` so merges are reversible and audited. Absorbed entities carry `mergeState.status = merged_away`.

## Living status and sensitive-location enforcement (BB-015)

Unknown living status defaults to `unknown` and is treated as living at the model layer (`@blap/domain` / constitution).

`@blap/security` is the **single choke point for public serialization**. Location facts carry three precision tiers — evidence (exact), internal (staff), and public (always reduced). Constitution `sensitivityRules` define sensitivity classes, precision-reduction reasons, residential precision levels, and public caps.

- `reducePublicPrecision` / `redactLocationForPublic` reduce precision and coarsen coordinates + geohash before publication; living/unknown residential is capped at `city`, deceased occupied private residences at `neighborhood`.
- `toPublicEntityProjection` / `toPublicSearchDocument` / `redactForPublicExport` build public payloads; `assertPublicProjectionSafe` fails closed on prohibited precision, address fields, or exact coordinates.
- The `publicReleases/{id}/entities` converter (`@blap/firebase`) runs `assertPublicProjectionSafe` on every `toFirestore`, and search-index docs carry only a coarse geohash — never address fields.
- `@blap/observability` loggers accept the security redactor so residential addresses and exact coordinates are scrubbed from logs and error telemetry.
- BB-019 public projection/search writers **must** go through `@blap/security` serializers.

## Auth claims

Custom claims (minted by privileged backend; BB-027): `admin` / `research` / `publication` / `security` booleans and/or `bb_role`. Research never authorizes publish.

## Code

| Artifact | Location |
|----------|----------|
| Security rules | `infra/firebase/firestore.rules` |
| Indexes | `infra/firebase/firestore.indexes.json` |
| Domain types / geohash / merge / provenance / claims / audit history | `@blap/domain` |
| Paths / types / converters / transaction + consumer helpers | `@blap/firebase` → `src/firestore/` |
| Seed fixtures | `packages/firebase/fixtures/firestore-seed.ts` |
| Server publish guards | `@blap/data-access` → `src/firestore/` |
| Redaction + public serialization (BB-015) | `@blap/security` → `src/{sensitivity,redaction,serialize}.ts` |

## Emulator tests

```bash
pnpm firebase:emulators
# other terminal
CI_REQUIRE_FIREBASE=1 pnpm --filter @blap/firebase test
```

## Public projection and immutable releases (BB-019)

Public traffic resolves `publicMeta/activeRelease`, then reads only
`publicReleases/{releaseId}/entities/{entityId}` documents whose immutable `releaseId`
matches that pointer. Canonical entities, claims, draft releases, and preview releases are
never public render inputs.

### Release document

`publicationReleases/{releaseId}` carries:

- lifecycle `status`: `draft` · `preview` · `active` · `superseded` · `rolled_back`;
- a signed manifest envelope containing the immutable manifest, its canonical-JSON
  `sha256` digest, signing algorithm, key id, and signature;
- `searchIndexVersion`, which must equal the version inside the signed manifest;
- creation metadata and lifecycle timestamps.

Manifest entries bind each entity revision to both its Firestore projection path and
its JSON snapshot object path, with an independent `sha256` content hash for each
payload. Entries are sorted by entity id before signing. Existing manifest, projection,
snapshot, and search-index objects are never edited to correct a release; correction
creates a new release.

### Snapshot object layout

```text
public/releases/{releaseId}/entities/{entityId}.json
```

Each entity JSON object has `schemaVersion`, an `entity` projection produced through
`@blap/security`, and metadata containing `releaseId`, canonical entity
`revision`, `searchIndexVersion`, and `manifestHash`. Object ids are validated as single,
non-traversing path segments.

### Activation and rollback

`activatePublicationRelease` uses one Firestore transaction for the target lifecycle
status, prior lifecycle status, `publicMeta/activeRelease` pointer, append-only audit
event, pending outbox message, and idempotency marker. Normal activation accepts only
`preview`; rollback accepts only an existing `superseded` or `rolled_back` release and
does not rebuild projections, snapshots, or search data. Before staging writes, activation
requires synchronous signature verification against a trusted publication public key;
verification performs no I/O because Firestore may retry the transaction callback.

The active pointer stores `releaseId`, `activatedAt`, `searchIndexVersion`, and
`manifestHash`. Public resolvers fail closed unless the pointed release is `active` and
all pointer fields match its signed immutable manifest.

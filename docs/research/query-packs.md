# Versioned historical query packs (BB-038)

Contract-layer API for versioned discovery query packs grouped by entity type and research theme. In-memory registry in this bead; Firestore persistence follows in a later bead.

## Domain API (`@black-book/domain` → `query-packs/`)

Parent agent merges `packages/domain/src/query-packs/index.ts` into the package barrel:

```typescript
export * from './query-packs/index.js';
```

| Function | Purpose |
|----------|---------|
| `buildQueryPack` | Construct a pack with semver + canonical content hash |
| `registerQueryPack` / `resolveQueryPackForRun` | In-memory registry lookup by entity kind + theme |
| `toPublicSafeTerms` | Strip research-only offensive historical terms from public output |
| `toResearchQueryTerms` | Internal query building including flagged historical terms |
| `classifySignalStrength` | Strong/medium/weak classification; weak → candidates only |
| `stampDiscoveryRun` | Attach query-pack version to every discovery run |
| `recordQueryPackMetric` / `computeEffectivenessMetrics` | Effectiveness tracking per pack version |

## Term classes

| Class | Role |
|-------|------|
| `positive` | Primary inclusion signal |
| `negative` | Exclusion / down-rank signal |
| `historical` | Period-appropriate language |
| `modern` | Contemporary terminology |
| `geographic` | Location anchor |
| `alias` | Alternate names / abbreviations |
| `source_specific` | Adapter-scoped tokens (requires `sourceId`) |

Terms flagged `researchOnlyOffensive: true` are retained for internal archival queries but never emitted through public interfaces (`toPublicSafeTerms`).

## Version identity

Each pack carries:

- **semver** — human-reviewable version (e.g. `1.0.0`)
- **contentHash** — sha256 of canonical JSON (sorted terms)
- **versionId** — composite `${semver}+${shortHash}` stamped on discovery runs

Content changes produce a new hash even when semver is unchanged, making diffs reviewable.

## Shared schemas

- `packages/schemas/query-packs/query-pack.v1.schema.json`
- `packages/schemas/query-packs/query-pack-fixture.v1.schema.json`

Gold fixture: `packages/domain/src/query-packs/fixtures/person-civil-rights-fixture.v1.json`

## Python mirror

`workers/research/src/black_book_research/query_packs/` mirrors the TypeScript contract for Cloud Run jobs.

## Acceptance mapping

1. Query-pack changes reviewable and versioned → semver + contentHash + versionId
2. Weak signals produce candidates only → `classifySignalStrength` + `assertMayPromoteBeyondCandidate`
3. Public interfaces hide offensive historical default language → `toPublicSafeTerms`
4. Every discovery run records query-pack version → `stampDiscoveryRun`

## Deferred (not this bead)

- **Firestore persistence** for query packs and effectiveness metrics
- **Discovery pipeline integration** — BB-039 wires `stampDiscoveryRun` into campaign runs
- **Admin UI** for pack review and approval — BB-056

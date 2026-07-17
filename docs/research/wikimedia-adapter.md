# Wikimedia discovery adapter (BB-045)

Contract-layer adapter for English Wikipedia and Wikidata discovery. Produces BB-037 `AdapterCandidateRecord` output with metadata and identifiers only — Wikipedia prose is not copied by default.

## Domain API (`@black-book/domain` → `adapters/wikimedia/`)

Parent agent merges `packages/domain/src/adapters/wikimedia/index.ts` into the adapters barrel.

| Module | Purpose |
|--------|---------|
| `category-graph` | Curated category nodes/edges for bounded traversal |
| `category-gate` | Explicit seed-category gate; membership ≠ inclusion |
| `contract` | Default `SourceAdapterContract` for registry registration |
| `extractors` | Wikidata IDs, aliases, locations, relationships, external refs |
| `search` | MediaWiki search response parsing (fixture-driven) |
| `api` | Single-page API fetch normalization |
| `bulk` | Dump-style batch processing (no public SPARQL dependence) |
| `normalizer` | Shared normalization to `AdapterCandidateRecord` |

## Ingest modes

Both `api` and `bulk` call the same normalizer (`normalizeWikimediaPage`). Fixture tests assert `candidatesEquivalent` across modes for the Rosa Parks sample page.

## Acceptance mapping

| Requirement | Implementation |
|-------------|----------------|
| Category membership never automatic inclusion | `evaluateCategoryGate` requires curated **seed** category match |
| Wikipedia prose not copied by default | `includeProse: false` enforced in payload + `assertSearchSnippetsNotCopied` |
| Revision + external identifiers retained | `revisionId`, `revisionTimestamp`, `wikidataId`, `externalReferences` on payload |
| Bulk and API same normalized contract | Shared normalizer + equivalence tests |
| Attribution on reuse | `attribution` block with CC BY-SA notice |
| No live network in tests | JSON fixtures under `fixtures/` |

## Shared schemas

- `packages/schemas/adapters/wikimedia/wikimedia-payload.v1.schema.json`
- `packages/schemas/adapters/wikimedia/wikimedia-category-graph.v1.schema.json`

## Python mirror

`workers/research/src/black_book_research/adapters/wikimedia/` mirrors the TypeScript contract for Cloud Run jobs.

## Deferred (not this bead)

- Live MediaWiki / Wikidata HTTP clients
- Firestore persistence for adapter runs
- Registry UI registration of `wikimedia-discovery-v1`

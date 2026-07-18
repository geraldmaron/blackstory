# Candidate discovery pipeline (BB-039)

Contract-layer API for ingesting adapter candidates, extracting signals, deduplicating, and running bounded discovery campaigns. Discovery produces **private research candidates only** — never public entities.

## Domain API (`@blap/domain` → `discovery/`)

Parent agent merges `packages/domain/src/discovery/index.ts` into the package barrel:

```typescript
export * from './discovery/index.js';
```

| Module | Purpose |
|--------|---------|
| `ingestion` | Bulk and API candidate ingestion interfaces |
| `hashing` | Content hashing via provenance `hashUtf8`; reproducibility fingerprint |
| `identity` | Candidate identity keys and source references |
| `geography` | Basic geographic hint extraction from candidate text |
| `signals` | Strong/medium/weak extraction via query-pack `classifySignalStrength` |
| `deduplication` | Merge duplicate records without losing provenance |
| `quarantine` | Retry, quarantine, dead-letter handling; continue-on-quarantine |
| `campaign` | Campaign boundaries and budget enforcement |
| `pipeline` | `runDiscoveryCampaign` orchestration |
| `guard` | `assertDiscoveryCannotPublish` — blocks public projection writes |

## Reproducibility

Every campaign run:

1. Stamps query-pack version via `stampDiscoveryRun` (BB-038)
2. Records source parser versions from adapter provenance
3. Emits `DiscoveryReproducibilityStamp.fingerprint` for audit replay

## Shared schema

- `packages/schemas/discovery/discovery-candidate.v1.schema.json`

## Python mirror

`workers/research/src/black_book_research/discovery/` mirrors the TypeScript contract for Cloud Run jobs.

## Acceptance mapping

| Requirement | Implementation |
|-------------|----------------|
| Discovery never creates public entities | `assertDiscoveryCannotPublish`; candidates use `discovery-candidate.v1` schema only |
| Duplicate source records merge without losing provenance | `mergeDuplicateCandidates` accumulates `sourceReferences` |
| Failed candidates do not block campaign | `continueOnQuarantine` + per-candidate quarantine in `runDiscoveryCampaign` |
| Reproducible from source + query-pack version | `stampDiscoveryReproducibility` + `stampDiscoveryRun` |

## Deferred (not this bead)

- Firestore persistence for discovery candidates and campaign runs
- Adapter-specific discovery implementations (BB-045, BB-046)
- Entity resolution (BB-041)
- Relevance scoring — see [relevance-engine.md](./relevance-engine.md) (BB-040)

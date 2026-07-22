# Source registry and adapter contract

Contract-layer API for registering source adapters, approving policies, and gating research runs. Persistence is in-memory in this bead; Firestore wiring follows in a later bead.

**Context indicators (statistics lane):** Pre-ingestion metadata for demographics/context datasets lives in [`external-data-sources.ts`](../../packages/domain/src/external-data-sources.ts) and the ranked theme matrix in [`context-data-source-matrix.md`](context-data-source-matrix.md) — not in `registerSource`.

## Domain API (`@repo/domain` → `adapters/`)

Parent agent merges `packages/domain/src/adapters/index.ts` into the package barrel.

| Function | Purpose |
|----------|---------|
| `registerSource` | Register adapter contract + evidence source (starts `disabled`) |
| `approveSourcePolicy` | Approve or canary-enable a registered source |
| `listSourceEntries` / `getSourceEntry` | Query registry |
| `assertAdapterMayRun` | Fail-closed gate before any adapter run |
| `evaluateRunHealth` | Quarantine on record-count or schema drift |
| `stampCandidateProvenance` | Attach source + parser provenance to candidates |
| `validateAdapterCandidates` | Validate adapter output against shared schema version |

## Registry states

| State | May run? | Notes |
|-------|----------|-------|
| `disabled` | No | Default after registration |
| `approved` | Yes | Requires `approvedAt` / `approvedBy` |
| `canary` | Yes (sampled) | Use `selectCanaryRecordIndices` |
| `quarantined` | No | Set after drift detection |
| `dead_letter` | No | Repeated quarantine threshold |

## Shared schema

JSON Schema fixture: `packages/schemas/adapters/candidate-record.v1.schema.json`

Domain validation enforces the same shape via `ADAPTER_CANDIDATE_SCHEMA_VERSION` (`candidate-record.v1`).

## Python mirror

`workers/research/src/black_book_research/adapters/` mirrors the TypeScript contract for Cloud Run jobs.

## Deferred (not this bead)

- **Admin registry UI** —  Administration and research console
- **Live Firestore persistence** — `SourceRegistryStore` interface only; implement against `evidenceSources`
- **HTTP admin API** — register/approve endpoints on admin service
- **Telemetry alerts** — parser drift metrics recorded here; alerting in

## Acceptance mapping

1. No adapter runs without approved policy → `assertAdapterMayRun`
2. Unexpected record-count / schema changes quarantine → `evaluateRunHealth`
3. Adapter output validates against shared schemas → `validateAdapterCandidates` + JSON schema fixture
4. Every candidate retains source and parser provenance → `stampCandidateProvenance` / `AdapterCandidateProvenance`

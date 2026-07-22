# ADR-014: Vector search (embedding pipeline and Postgres pgvector)

- **Status:** Accepted (amended by [ADR-020](./ADR-020-supabase-postgres-system-of-record.md))
- **Date:** 2026-07-17
- **Amended:** 2026-07-22
- **Depends on:** ADR-004, ADR-005, ADR-008, ADR-020

Filename kept for link stability. The Firestore KNN path documented historically is **not**
the live product store.

## Scaffold vs target

| Aspect | Today | Target |
|--------|-------|--------|
| Semantic search | Embedding helpers in-repo; store migrating | Own embedding pipeline (`gemini-embedding-001`) + **Postgres `pgvector`** |
| Embedding storage | Historical Firestore sibling collection design | Vector column(s) in Supabase Postgres (ADR-020) |
| Vector query surface | `apps/api-public` only | Same; never a client SDK path |
| Research-side reuse | Pure similarity helpers in `@repo/domain` | Same; no auto-publish |

## Context

Bounded field/prefix search (ADR-008) cannot answer paraphrases such as “the school where the
sit-ins started.” Semantic recall needs embeddings. ADR-011 originally answered “how do we do
this inside Firebase?” with Firestore native KNN. ADR-020 moved the SoR to Supabase Postgres
with `pgvector`; this ADR follows that store while keeping the embedding pipeline owned in-repo.

## Decision

1. **Embedding pipeline is our own code**, calling `gemini-embedding-001` with
   `outputDimensionality: 768`, defensive truncation/normalization, and unit vectors compared
   with cosine / inner-product distance as implemented for Postgres.
2. **Storage is Postgres `pgvector`** on `blackstory-app`, keyed to canonical entities, with
   model/dims metadata and a source-text hash for incremental backfill. Do not force re-embed
   on every immutable release cut (ADR-004).
3. **Pre-filters** (`kind`, jurisdiction/state, era) keep neighbor scans bounded.
4. **Nearest-neighbor queries are served only from `apps/api-public` server code**, behind the
   same search guardrails, quotas, kill switches, and attestation/request-integrity controls as
   other expensive reads. Client SDKs never call the vector index directly.
5. **Research-side reuse is pure functions**, not a live auto-merge pipeline. Similarity helpers
   may flag near-duplicates; they must not publish.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Keep Firestore native KNN as product path | SoR is Postgres (ADR-020); dual vector stores add drift |
| Vertex AI Vector Search from day one | Fixed cost and second IAM/network surface before measured need |
| External search SaaS for semantics only | Deferred until Postgres/`pgvector` measured insufficient (ADR-008 spirit) |
| Storing vectors only on immutable public projection docs | Couples embedding freshness to release cadence unnecessarily |

## Consequences

- New vector work lands in Postgres migrations and `@repo/domain` / data-access helpers.
- Historical Firestore embedding collections and indexes are wind-down artifacts, not new-feature
  targets.
- Hybrid fusion of structured + semantic recall remains a separate concern.

## Migration triggers

- Revisit an external vector platform only after measured latency/recall failure under
  production-like load with guardrails intact.

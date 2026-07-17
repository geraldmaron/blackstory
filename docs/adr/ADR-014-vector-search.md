# ADR-014: Vector search (embedding pipeline and Firestore native KNN)

- **Status:** Accepted
- **Date:** 2026-07-17
- **Bead:** BB-071
- **Depends on:** ADR-004, ADR-005, ADR-011, ADR-008 (amends)
- **Implements toward:** BB-072

## Scaffold vs target

| Aspect | Today (verified) | Target (current phase) |
|--------|------------------|------------------------|
| Semantic search | Not implemented | Own embedding pipeline (`gemini-embedding-001`) + Firestore native KNN (`findNearest`), server-only |
| Embedding storage | Not implemented | Sibling `entityEmbeddings` Firestore collection, one document per canonical entity |
| Vector query surface | Not implemented | `GET /v1/search/nearest` in `apps/api-public` only — never a client/web SDK path |
| Research-side reuse | Not implemented | Pure candidate-recall and near-duplicate functions in `@black-book/domain`, wiring into `workers/research/` documented but not live |
| Vertex AI Vector Search | Not used, not planned | Explicit non-goal at this scale (see Rejected alternatives) |

## Context

ADR-008 established bounded Firestore queries (prefix/field filters) plus geohash as the search
and geography store, explicitly deferring a dedicated search engine "until Firestore + geohash
proven insufficient." That decision is sound for exact and prefix lookups, but it cannot answer
what a user means in their own words — "the school where the sit-ins started" — because bounded
field queries only match what was typed, not what was meant. The research pipeline has the same
gap from the other direction: discovery candidates and accepted sources that describe the same
underlying fact in different words currently only get caught by exact content-hash dedup
(`packages/domain/src/discovery/deduplication.ts`, BB-039), which misses paraphrase-level
duplicates entirely.

The owner asked directly how vector search could work "within Firebase" at all, given the
product's Firebase-first, Cloud-SQL-deferred posture (ADR-011). Firestore's native KNN vector
search answers that question directly: it is GA, it stays entirely inside Firestore (no
additional cloud service, no additional IAM surface, no additional network boundary), and it
composes with the same Admin-SDK-only, server-side access pattern every other privileged write
path in this repo already uses.

## Decision

1. **Embedding pipeline is our own code**, not the pre-GA `firestore-vector-search` Firebase
   Extension. It calls `gemini-embedding-001` via the Gemini Developer API (API-key auth, not
   Vertex AI), requesting `outputDimensionality: 768` and defensively re-truncating and
   unit-normalizing the result client-side regardless of what the API returns (Matryoshka
   truncation: any prefix of the model's native output is itself a valid, if lower-fidelity,
   embedding). Vectors are unit-normalized and compared with `DOT_PRODUCT` distance, which is
   equivalent to cosine similarity for unit vectors but cheaper for Firestore to compute.
2. **Storage is a sibling `entityEmbeddings` collection** (one document per canonical entity: id,
   `kind`, optional `state`/`eraBucket` pre-filter fields, the vector, model/dims metadata, and a
   `sourceTextHash` for incremental backfill), not a new field on the existing
   `publicEntityProjectionSchema` document. This avoids re-embedding every entity on every
   immutable release cut (ADR-004) — an entity's vector reflects its latest canonical text and is
   recomputed only when that text changes, independent of how many releases exist.
3. **Composite vector indexes pre-filter by `kind`, `state`, and `eraBucket`.** Firestore KNN is
   an exact/flat scan over whatever the pre-filter selects, so keeping the pre-filtered set small
   is the only lever that keeps `p95` latency sane at scale. `infra/firebase/firestore.indexes.json`
   defines a bare vector index plus every practical combination of the three pre-filter fields.
4. **`find_nearest` is served only from `apps/api-public` server code**, composed from — not
   replacing — the existing BB-026/BB-025/BB-035 guardrails: the natural-language query text is
   validated by the *same* `evaluateSearchQueryGuardrails` function `/v1/search` uses, the
   neighbor count `k` is capped by that same function's `pageSize` limits (default 20, max 50 —
   well under the platform ceiling of 1000 neighbors), App Check runs first, and the request is
   denied while the existing `search` kill switch (BB-035) is engaged or `public-static-mode` is
   active. Client/web SDKs cannot call `findNearest` at all, so there is no parallel surface to
   accidentally expose.
5. **Research-side reuse is pure functions, not a live pipeline integration.** `@black-book/domain`'s
   `similarity/` module provides `findSimilarCandidates` (candidate recall: "find sources similar
   to this accepted one") and `findNearDuplicatesOf`/`clusterNearDuplicates` (semantic
   near-duplicate flagging) over pre-computed embeddings. Both are read-only comparisons — neither
   merges nor publishes anything, consistent with the BB-039 discovery-cannot-publish guard.
   Wiring these into the live `workers/research/` discovery workflow is a documented integration
   point (see Consequences), not done in this pass.

## Rationale

Firestore native KNN is GA, has a documented flat-index cost model (1 read per 100 scanned vector
index entries, 10x the normal 1-per-1000 metering, plus 1 read per document returned), a 2048-dim
field cap comfortably above the chosen 768 dims, a 1000-neighbor platform ceiling, and requires no
new infrastructure beyond what this project already runs. It resolves the owner's question about
vector-within-Firebase concretely: there is no separate vector database, no separate network
boundary, and no separate IAM surface to secure — the existing Firestore Admin SDK access pattern
(server-only, no client SDK exposure) already covers it, because `findNearest` is a query
capability the client/web SDKs never had in the first place.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|---------------|
| Vertex AI Vector Search | Always-on per-node cost floor (roughly $68+/month/node, realistically several hundred/month once deployed for availability) is unjustified for a corpus well under ~1M vectors. It also introduces a second infrastructure surface (separate service, separate IAM, separate network boundary) that Firestore-native KNN makes unnecessary at this scale. Revisit only under the escalation triggers below. |
| Pre-GA `firestore-vector-search` Firebase Extension | Gives up control over the embedding model, output dimensionality, and retry/backoff behavior — exactly the three things this bead needed to own (see `packages/firebase/src/embeddings/provider.ts`'s explicit retry wrapper and `gemini-provider.ts`'s explicit `outputDimensionality` request). It is also pre-GA, which this project avoids for a load-bearing write path per its general risk posture. |
| External search engine (Typesense/Algolia) from day one | Per ADR-008 doctrine, an external search platform is deferred until Firestore-based approaches are measured insufficient, not adopted preemptively. Nothing about semantic search changes that calculus — it is a new *recall lane*, not evidence that the existing doctrine failed. |
| Storing the vector on the existing public entity projection document | Would force re-embedding every entity on every immutable release cut, multiplying embedding cost and write volume for no benefit (an entity's semantic content rarely changes between releases). A sibling collection decouples embedding freshness from release cadence. |
| Fusing semantic and structured results inside this bead | BB-072 (hybrid retrieval / ranking fusion, still blocked) owns combining the ADR-008 structured/prefix recall lane with this bead's semantic recall lane (e.g. via RRF). This bead delivers the raw KNN query path BB-072 will consume, not the fusion layer itself. |

## Consequences

- `packages/firebase/src/embeddings/` owns the embedding pipeline (text construction, provider
  abstraction, truncation/normalization, the Firestore-backed and in-memory `VectorIndexStore`
  implementations) and a budget-aware backfill CLI (`backfill-cli.ts`).
- The **on-write integration point is documented, not live-wired**: the publication/projection
  build step in `workers/publication/` (which does not yet exist as a concrete Cloud Run Job)
  should call `embedEntity` and `VectorIndexStore.writeEmbedding` after a canonical entity's
  title/summary/place/era-relevant fields change or the entity is (re)promoted into a release.
  Until that worker exists, the backfill CLI is the only way new/changed entities get embedded.
- The **research-pipeline integration point is documented, not live-wired**: `workers/research/`
  (currently a minimal Python scaffold with no discovery logic yet) should call the TypeScript
  `@black-book/domain` similarity functions — or a Python port of the same pure math — at
  candidate-ingestion time, after the existing exact content-hash dedup (BB-039). Neither
  function may merge or auto-publish, matching the existing discovery-cannot-publish guard.
- `infra/firebase/firestore.rules` was not touched by this bead (out of file-ownership scope). The
  `entityEmbeddings` collection is currently unprotected by explicit client-deny rules; it is safe
  today only because nothing writes to it except the server-side Admin SDK (which bypasses rules
  entirely) and no client SDK path reads it. Adding an explicit deny-all rule for defense in depth
  is a small, low-risk follow-up, not done here.
- A live `GEMINI_API_KEY` (Secret Manager / injected env, never hardcoded — see `.env.example`) is
  required for real embeddings. Every module in this bead is dependency-injected so tests and CI
  run against `createDeterministicMockEmbeddingProvider` instead; the retrieval eval in
  `packages/testing/src/gold-corpus/retrieval-eval.ts` documents this explicitly and records a
  real (if intentionally modest — see that file's caveats) recall@k/MRR number from the mock
  provider, not a fabricated one.
- Cost is small at this project's scale: embedding ~100k documents of ~500 tokens each is roughly
  $7.50 one-time via the Gemini Developer API. The 10x vector-index read-metering multiplier
  matters more at query volume than at embedding time; pre-filtering (Decision #3) is the
  mitigation.

## Escalation triggers

Revisit this decision — and only then — when **any** of the following hold:

1. The corpus in query scope exceeds roughly 1M vectors.
2. Sustained p95 KNN query latency fails its target despite pre-filtering via the composite
   indexes in Decision #3 (i.e., pre-filtering has already been tried and measured insufficient).
3. Product needs keyword-search UX that vector KNN structurally cannot provide — typo tolerance,
   faceted filtering beyond simple equality pre-filters, or relevance tuning knobs.

**Escalation order when a trigger fires:** evaluate a Typesense Firestore Extension or Firestore
Enterprise's native full-text + vector pipeline **before** ever considering Vertex AI Vector
Search. Vertex AI's always-on per-node cost floor (Rejected alternatives, above) is the least
justified option at any scale this product is likely to reach organically; it is a last resort,
not a default upgrade path.

## Rollback considerations

- Kill-switch semantic search independently via the existing `search` core switch (BB-035) — see
  `apps/api-public/src/vector-search-kill-switch.ts`. This is the same switch `/v1/search`
  already uses, so `public-static-mode` correctly stops both together, and enabling/disabling
  semantic search specifically requires no new operational tooling. A dedicated `vector-search`
  switch id is a small additive follow-up to `packages/config/` if independent control is later
  needed — not required for the initial rollout.
- Structured/prefix search (ADR-008) is unaffected by disabling semantic search; they are
  independent recall lanes until BB-072 fuses them.
- Deleting or corrupting the `entityEmbeddings` collection does not affect canonical or public
  projection data — it is a derived index, fully reconstructable by re-running the backfill CLI.

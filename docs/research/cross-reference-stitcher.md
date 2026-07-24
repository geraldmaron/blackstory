# Cross-Reference Entity Resolution (the Multi-Source Stitcher)

A research-discovery methodology that extends the **citation-independence** principle
(near-duplicate excerpt similarity, cosine ≥ 0.92 — see
[`citation-independence-review-signal.md`](./citation-independence-review-signal.md))
from the *citation* level down to the *entity* level.

Where citation-independence asks _"do two citations share the same upstream prose?"_,
the stitcher asks _"does the same person/place appear in two or more otherwise-independent
source datasets while still being absent from the catalog?"_. That cross-source
co-appearance is itself a unit of corroboration: it lets a single private discovery
candidate carry **both** source references so a reviewer can judge whether the accumulated
evidence clears the confidence floor.

Domain module: `@repo/domain` → `packages/domain/src/citation-independence/cross-reference-stitcher.ts`.

## The bottleneck it addresses (repo-w4bk)

`repo-w4bk` has **521 single-source records stuck at 0.72** — below the promotion
confidence floor because a lone source cannot triangulate itself. Many of those records
describe the same obscure person named in more than one dataset that the pipeline never
cross-checked. The stitcher surfaces exactly those overlaps:

1. **Aggregate independent references.** When a person appears in ≥ 2 distinct source
   datasets and is not already in the catalog, their mentions are merged onto one
   candidate whose `identity.sourceReferences` now contains a reference per source.
2. **Raise review-readiness, never auto-promote.** The corroboration is evidence a human
   reviewer can act on to lift a record off the 0.72 floor. The module itself only sets
   the candidate to `merged` / `candidate_only`; the confidence engine and human approval
   still own promotion (ADR-009).

The effect is a recall lane for the single-source backlog: instead of 521 records sitting
alone, the ones with genuine cross-source support are stitched together and routed to
review with their provenance already assembled.

## API (all pure, read-only, deterministic)

| Function | Purpose |
|---|---|
| `normalizePersonName(name)` | NFKD fold + diacritic strip + honorific/suffix removal + lowercase + whitespace collapse → comparison key. |
| `extractPersonMentions(dataset)` | Normalize one dataset's mentions into `NormalizedPersonMention[]` (each with a resolved `SourceReference`); drops empty names; sorted by `mentionId`. |
| `findCrossSourceMatches(datasets, catalogCheckFn)` | Persons in ≥ `CROSS_REFERENCE_MIN_SOURCES` (2) **distinct** sources that `catalogCheckFn` reports as NOT cataloged. Sorted by `personKey`. |
| `buildCrossReferenceCandidates(matches)` | `DiscoveryCandidateRecord[]`, one per person, with all source references aggregated via the discovery `mergeDuplicateCandidates` pattern. Survivors land in status `merged`. |

`catalogCheckFn: (probe: { personKey, displayName }) => boolean` is **injected** — the
module never queries a live catalog itself. Return `true` when the person is already
cataloged (and must be excluded). This mirrors `catalog-match.ts`'s `no_match` posture:
cross-reference candidates are, by construction, the entities the catalog does **not** yet
have.

### Reuse of existing patterns

- **`mergeDuplicateCandidates`** (`discovery/deduplication.ts`) does the reference
  aggregation. Each per-source mention becomes a pre-merge `DiscoveryCandidateRecord`
  sharing one content hash (`cross-reference-stitcher.v1::person::<personKey>`), so the
  merge unions their source references onto a single survivor without losing provenance —
  exactly the "duplicate source records merge without losing provenance" acceptance rule.
- **Citation-independence** is the conceptual parent: independence is corroboration only
  when the sources are genuinely separate. Cosine ≥ 0.92 guards citation-level
  near-duplication; distinct `sourceId`s guard entity-level independence here.

## Invariants honored

- **Research cannot publish (ADR-009).** Output is a **private** `DiscoveryCandidateRecord`
  only — `schemaVersion: discovery-candidate.v1`, `signals.outcome: candidate_only`. No
  public projection, release row, or canonical entity is ever written. Corroboration
  raises review-readiness; it never auto-promotes.
- **Evidence before assertion.** A match is only produced from ≥ 2 real source references;
  nothing is asserted about the entity beyond "named in these sources".
- **Dignity / living addresses.** The module handles person *name tokens* only; it never
  emits addresses or living-person residence data into any public surface.
- **Determinism / purity.** No wall-clock or network reads; timestamps derive from the
  mentions' `capturedAt` range. Output is stable across input ordering.
- **`@repo/security` safe-fetch.** No fetching occurs in this module; datasets are supplied
  by callers, which must have acquired them via `@repo/security` safe-fetch.

## Migration

**No migration needed.** This methodology introduces no new tables. Confirmed
cross-source stitches map onto the **existing** canonical merge ledger after human review:

| Concept | Existing ledger home |
|---|---|
| A stitched (survivor) entity | `bb_canonical.entity_merges` (`survivor_id`, `status`, `reason`, `actor_id`) |
| Absorbed cross-source appearances | `bb_canonical.entity_merge_absorbed` |
| Supporting evidence for the merge | `bb_canonical.entity_merge_evidence` |
| Pre-review private candidates | discovery candidate store (`discovery-candidate.v1`), unioned via `mergeDuplicateCandidates` |

The reserved migration prefix `20260724000007` is therefore **left unused** for this work —
no schema change ships.

## Integration

`buildCrossReferenceCandidates` output flows into the same private candidate handling as
the rest of discovery (dedup already applied; `attachCatalogMatch` may still run for
propose/review/no_match blocking). Confirmed stitches are recorded by a human against
`bb_canonical.entity_merges` — never by this module.

The barrel `packages/domain/src/citation-independence/index.ts` is **not edited by this
change**. The parent agent should add the following exports (values then types):

```typescript
export {
  CROSS_REFERENCE_STITCHER_VERSION,
  CROSS_REFERENCE_MIN_SOURCES,
  CROSS_REFERENCE_CLASSIFICATION,
  normalizePersonName,
  extractPersonMentions,
  findCrossSourceMatches,
  buildCrossReferenceCandidates,
} from './cross-reference-stitcher.js';
export type {
  PersonMentionInput,
  SourceDataset,
  NormalizedPersonMention,
  ExtractedPersonMentions,
  CatalogPersonProbe,
  CatalogCheckFn,
  CrossSourceMatch,
} from './cross-reference-stitcher.js';
```

No top-level package barrel edit is required beyond whatever already re-exports
`citation-independence/index.js`.

## Non-goals

- Auto-promoting, auto-publishing, or bypassing the confidence engine / consensus controls.
- Merging canonical entities automatically — human review records the merge in the ledger.
- Fuzzy same-person inference beyond deterministic name normalization (no embeddings here;
  cosine similarity remains the citation-level signal in `review-signal.ts`).
- Fetching or storing source datasets — callers supply them (safe-fetch upstream).

## Related docs

- [`citation-independence-review-signal.md`](./citation-independence-review-signal.md) — the citation-level parent signal.
- [`discovery-pipeline.md`](./discovery-pipeline.md) — private-candidate pipeline, `mergeDuplicateCandidates`, `catalog-match`.
- `docs/research/research-kernel.md` — ledger schemas and human-in-the-loop release policy.

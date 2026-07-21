# Citation independence review signal

BlackStory methodology claims triangulation across **independent** sources. Two citations can carry
different URLs and independence labels while still excerpting the same underlying prose. The domain
module `@repo/domain` (path `packages/domain/src/citation-independence/`) adds a **review-only**
signal for that gap: it never auto-rejects, auto-publishes, or changes promotion gates.

## What the signal does

`findCitationIndependenceReviewFlags` accepts a batch of citations, each with:

- `citationId`
- `independenceGroupId` (and optional `coordinatedGroupId`, matching promotion semantics)
- optional excerpt embedding `vector`

It returns `ReviewFlag` records for every pair that:

1. claims **separate** independence keys (see below),
2. both have vectors, and
3. cosine similarity meets the threshold (default `0.92`, aligned with near-duplicate recall).

Each flag carries canonical citation ids (`citationIdA` < `citationIdB`), both independence keys,
similarity, and `kind: 'claimed_independence_high_similarity'`.

## Independence keys (promotion alignment)

The key function mirrors `independenceKey` in `packages/domain/src/promotion/controls.ts`:

| Input | Key |
|---|---|
| No `coordinatedGroupId` | `independent:{independenceGroupId}` |
| With `coordinatedGroupId` | `coordinated:{coordinatedGroupId}` |

Pairs with the **same** key are treated as already grouped — no flag. Pairs with **different**
keys are "purported independent" and eligible for similarity review.

## Mapping to the research kernel ledger

This module stays **in-memory** for review-queue items. Persisted lineage lives in Supabase:

| Review signal | Ledger home | Notes |
|---|---|---|
| Flag pair `(cite-a, cite-b)` | `bb_evidence.lineage_clusters` + `lineage_cluster_members` | Human may open or extend a cluster when similarity is confirmed |
| Near-duplicate relationship | `lineage_cluster_members.relationship = 'near_duplicate'` | Set only after human review — not by this function |
| Similarity score | `lineage_cluster_members.similarity` | Optional numeric audit field |
| Claim assignment lineage | `bb_canonical.evidence_assignments.lineage_cluster_id` | Each accepted assignment references one cluster |
| Capture root | `bb_evidence.lineage_clusters.root_capture_id` | Cluster anchor capture |

Workflow: flags surface in the operator review queue → reviewer inspects captures and
attributions (`bb_evidence.capture_attributions`) → if excerpts truly share upstream prose,
update lineage cluster membership and **re-count** independent lineages before promotion. Until
then, promotion continues to treat the citations as separate groups; the flag is advisory.

## Operator workflow

1. **Run the signal** when assembling or re-checking a research case (embeddings from the existing
   `@repo/firebase` pipeline or fixture vectors in dev).
2. **Triage each flag** — high similarity does not prove syndication; it warrants reading both
   captures, checking `capture_attributions`, and comparing content fingerprints.
3. **Resolve lineage** — merge into an existing `lineage_clusters` row or create one with explicit
   `method_version`, `confidence`, and `rationale`. Record `near_duplicate` (or a more specific
   relationship) on members.
4. **Re-evaluate promotion** — after cluster updates, re-run promotion / confidence tooling so
   independent lineage counts reflect human judgment.
5. **Never auto-publish** — flags do not block or pass publish gates on their own. They route
   attention; only human approval and existing gates may release content.

## Non-goals

- Auto-rejecting citations or claims based on similarity alone
- Auto-publishing or bypassing consensus / promotion controls
- Replacing fingerprint or coordinated-group detection in `promotion/controls.ts`
- Writing to Supabase from the pure function (callers persist review outcomes separately)

## Related docs

- `docs/research/confidence-lineage.md` — deterministic confidence and lineage grouping
- `docs/adr/ADR-014-vector-search.md` — embedding pipeline and similarity helpers
- `docs/research/research-kernel.md` — ledger schemas and human-in-the-loop release policy

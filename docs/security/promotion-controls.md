# Data-poisoning and promotion controls

Publication is a controlled state machine:

`submission/discovery → research case → proposed claim → accepted claim → publication candidate → release`

No intake record can write directly to a canonical claim or release. Each transition is forward-only. Claim approval is deterministic and requires an approver distinct from the proposer; an LLM may assist research but cannot approve a claim.

## Evidence gates

- Confidence and volume use independent lineages, not page or submission count. Syndicated, mirrored, translated, and copied pages with one lineage root count once.
- Coordinated sources sharing a campaign group collapse to one independent contribution.
- Exact-content fingerprints flag duplicates even when URLs and source identifiers differ.
- Blocked and below-policy source reputations fail promotion.
- Evidence from a source about itself cannot be the sole corroboration, regardless of repetition.
- Every proposed claim requires a completed, timestamped contradiction search with a query summary.
- A credible unresolved contradiction blocks promotion.
- Standard claims require at least two independent lineages and confidence `0.70`.
- High-impact claims require at least three independent lineages, at least two established or authoritative lineages, and confidence `0.85`.

The versioned policy contract is `packages/schemas/promotion/promotion-policy.v1.json`. Changing thresholds requires a reviewed policy-version change, not a runtime prompt.

## Review queues

- **Critical:** every high-impact claim and every claim below its confidence threshold.
- **Elevated:** standard claims within `0.10` of the threshold.
- **Standard:** standard claims at least `0.10` above the threshold.

Queue routing prioritizes review; it never bypasses an evidence gate.

## Publication preview and persistence

A publication preview compares claim sets and lists added, changed, removed and unchanged
claims. Approval must refer to the exact current claim version and evidence assignments.
An excerpt match proves attachment, not entailment. Source labels, citation counts and heuristic
scores cannot substitute for reviewed evidence or establish calibration.

Postgres persistence lives under `packages/ops-data/src/postgres/`. Canonical changes, audit
entries and outbox messages commit transactionally. Release activation has a separate authority
and signed-manifest gate. Verify effective grants and RLS under the actual operator role;
function-level checks do not compensate for a broadly privileged worker credential.

## Deployment verification

Before cutover, test rejected anonymous and research-worker publication, stale claim versions,
missing selectors, unresolved contradictions and approval by the proposer. Follow
[release](../runbooks/production-release.md) and [schema validation](../data/schema-validation.md).
Thresholds above are policy heuristics, not measured probabilities or proof of historical truth.

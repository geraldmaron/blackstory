# Data-poisoning and promotion controls

 makes publication a controlled state machine:

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

## Publication preview and transaction

A publication-candidate preview compares claim sets and explicitly lists added, changed, removed, and unchanged claims. Changed claims include both previous and candidate values.

`promoteClaimToPublicationCandidate` performs one Firestore transaction that:

1. verifies the persisted claim is accepted and records distinct proposer/approver identities;
2. verifies the deterministic gate and candidate metadata agree;
3. advances the promotion record and creates the immutable candidate;
4. appends the approval audit event, pending outbox message, and idempotency marker.

Any conflict aborts all writes. Replaying the same idempotency key produces no duplicate effects. Release activation remains governed by the signed-manifest transaction in `release-activation.ts`.

## Human Firebase/IAM steps

No cloud changes are applied by this bead. Before production rollout, a human administrator must review Firestore Security Rules and IAM so:

- intake and research identities cannot write `publicationCandidates`, `auditEvents`, `outboxMessages`, or release pointers;
- only the narrowly scoped promotion service identity can run the promotion transaction;
- publication approvers have review access but cannot impersonate proposers;
- audit and idempotency collections remain append-only to application identities.

Apply those controls only through the reviewed production rollout process after emulator and IAM review.

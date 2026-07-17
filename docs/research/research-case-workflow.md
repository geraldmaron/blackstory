# Research-case and publication workflow

BB-044 turns discovery candidates into reviewable research cases while preserving an
append-only decision history. Under ADR-011, canonical case records, assignments, backfill
jobs, and release references belong in Firestore. Public clients read only active release
projections; they never write workflow state.

## States and transitions

The workflow uses these stored states:

1. `candidate`
2. `relevance_review`
3. `relevance_confirmed`
4. `minimum_record`
5. `partial_enrichment`
6. `substantial_enrichment`
7. `insufficient_evidence`
8. `excluded`
9. `merged`
10. `retracted`

Cases enter relevance review from `candidate`. A passing BB-040 relevance assessment is
required for `relevance_confirmed`. The evidence checklist then determines whether the
record is minimum, partially enriched, or substantially enriched. Cases can be routed to
insufficient evidence, excluded with a structured reason, or merged into another case.

`merged` is terminal. Excluded, insufficient-evidence, and retracted cases may return to
relevance review only when the transition cites new evidence. Every transition appends its
actor, timestamp, reason code, human reason, and evidence identifiers to history. Leaving
`excluded` therefore does not erase the prior exclusion or its reason.

## Minimum publication record

Publication does not require optional enrichment. A sparse record is eligible when all five
minimum checklist items are complete and cite evidence:

- identity
- relevance assessment
- source citation
- public summary
- rights clearance

Dates, geography, corroboration, contradiction search, and historical context are
enrichment fields. Completing some produces `partial_enrichment`; completing all produces
`substantial_enrichment`. Missing enrichment can be scheduled as backfill without blocking
a minimum record.

Promotion composes with the BB-032 `research_case` promotion stage. Preview composes with
the BB-032 deterministic claim diff and reports added, changed, removed, and unchanged
claims before publication.

## Review operations

The domain module provides deterministic operations for:

- queue routing across relevance, minimum record, enrichment, publication, retraction, and
  backfill queues;
- assigning a reviewer, priority, assigning actor, and timestamp;
- validating evidence checklist completeness;
- building a release preview and promotion eligibility decision;
- scheduling future backfill for incomplete checklist fields.

Assignments and backfill records are workflow data in Firestore, not authorization grants.

## Exclusion and reconsideration

Exclusion requires a supported reason code such as outside scope, duplicate case, restricted
rights, failed relevance, or insufficient source evidence. The exclusion event remains in
history. Reconsideration requires one or more new evidence identifiers and appends a new
`new_evidence_received` transition.

## Retraction and release history

Retraction never deletes or rewrites a published release. The BB-044 helper composes with
BB-019 to build a new release manifest that omits the retracted entity. The old release ID,
replacement release ID, reason, actor, and timestamp remain on the case. The normal BB-019
sign, preview, and activation lifecycle must publish the replacement release before public
traffic changes.

This design preserves the original signed manifest and historical snapshot. It also makes a
retraction independently reviewable and reversible through release history rather than
destructive Firestore deletion.

## Server authorization

Clients must call a trusted server or worker. The Firebase helper checks verified Firebase
administrator claims and MFA before executing any callback:

- `research:write` is required for assignment, evidence changes, review transitions,
  previews, and backfill scheduling.
- `publication:publish` plus recent authentication is required for promotion.
- `publication:retract` plus recent authentication is required for retraction.
- administrators inherit both role sets.

Research-only identities cannot publish or retract. Publication-only identities cannot
change research workflow state. Firestore rules remain deny-by-default for direct canonical
client writes; Admin SDK handlers must use these server gates and the existing audit/outbox
transaction pattern when persistence is wired.

## Schemas and exports

Firestore-facing JSON Schemas are in:

- `packages/schemas/research-case/research-case.v1.schema.json`
- `packages/schemas/research-case/backfill-job.v1.schema.json`

The domain local barrel is `packages/domain/src/research-case/index.ts`. Package-root
integration should export `./research-case/index.js`. Firebase integration should export
`./firestore/research-case.js` from its Firestore and package barrels.

No Firebase or GCP resource is applied by BB-044. Collection rules, indexes, handlers, and
deployment remain reviewed human/deployment work when the persistence adapter is connected.

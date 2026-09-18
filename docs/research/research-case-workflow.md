# Research-case and publication workflow

Discovery candidates become reviewable cases with append-only decision history. Postgres
research and canonical tables hold workflow state; public clients read released projections.
The durable worker protocol is described in [operations](research-operations.md).

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

Cases enter relevance review from `candidate`. A passing  relevance assessment is
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

Promotion composes with the  `research_case` promotion stage. Preview composes with
the  deterministic claim diff and reports added, changed, removed, and unchanged
claims before publication.

## Review operations

The domain module provides deterministic operations for:

- queue routing across relevance, minimum record, enrichment, publication, retraction, and
  backfill queues;
- assigning a reviewer, priority, assigning actor, and timestamp;
- validating evidence checklist completeness;
- building a release preview and promotion eligibility decision;
- scheduling future backfill for incomplete checklist fields.

Assignments and backfill records are workflow data in Postgres, not authorization grants.

## Exclusion and reconsideration

Exclusion requires a supported reason code such as outside scope, duplicate case, restricted
rights, failed relevance, or insufficient source evidence. The exclusion event remains in
history. Reconsideration requires one or more new evidence identifiers and appends a new
`new_evidence_received` transition.

## Retraction and release history

Retraction never deletes or rewrites a published release. The  helper composes with
 to build a new release manifest that omits the retracted entity. The old release ID,
replacement release ID, reason, actor, and timestamp remain on the case. The normal
sign, preview, and activation lifecycle must publish the replacement release before public
traffic changes.

This design preserves the original signed manifest and historical snapshot. It also makes a
retraction independently reviewable and reversible through release history rather than
destructive record deletion.

## Server authorization

Trusted server operations verify a Supabase session and `app_metadata.app_role` using the
shared admin authorization helpers. Research workflow permission does not authorize publication.
Role-to-verb permissions live in `apps/web/src/admin/auth/staff-permissions.ts`; route handlers
use `route-permissions.ts`. Writes carry a verified actor and durable reason through the
Postgres audit/outbox transaction.

Case readiness alone does not approve a claim. Publication additionally checks the current
claim version, attached evidence selectors, reviewed confidence assessment, lineage and
contradiction policy. See [promotion controls](../security/promotion-controls.md).

## Contracts

The domain state machine is `packages/domain/src/research-case/`. JSON schemas are under
`packages/schemas/research-case/`. Persistence is under `packages/ops-data/src/postgres/`.
Backfill jobs describe explicit work; no timer is installed by creating a case or running this
workflow. Actual scheduling requires a separate authorized operational change.

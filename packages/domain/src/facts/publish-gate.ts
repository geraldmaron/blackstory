/**
 * Fail-closed publish gate for `FactRecord` (BB-086 acceptance criteria 1 & 2).
 *
 * "Unsourced" is not a publishable state: a fact may only transition to `published`/`corrected`
 * when every citation is structurally complete AND every web citation carries an archived-capture
 * pointer (`archivedUrl` + `archivedAt`) and a retrieval date (`accessedAt`) — see
 * `./citation.ts`. This mirrors `../citations/completeness-gate.ts`'s BB-083 claim-level gate and
 * `../publication/index.ts`'s BB-019 release-build discipline, applied to the fact registry's own
 * record shape.
 *
 * INTEGRATION POINT (documented, not live-wired — same convention as
 * `../citations/completeness-gate.ts`'s own INTEGRATION POINT comment): the real BB-019
 * projection-build pipeline (workers/publication/, per ADR-007) is the intended caller. Call
 * `assertFactMayPublish` immediately before including a fact in a release/projection build and do
 * not proceed if it throws.
 *
 * Independence of axes (AC1): this gate checks `status` transitions and citation completeness; it
 * never reads or derives `confidence` as a publish precondition. A `contested`-confidence fact
 * may publish (with its dispute disclosed via `confidenceNote`/`counterClaims[]`) exactly as
 * readily as an `established`-confidence one — confidence is a caveat, not a publish blocker.
 */
import { isSearchIndexableFactStatus, isPubliclyResolvableFactStatus, type FactStatus } from './status.js';
import { hasCompleteFactCitations, type FactRecord } from './record.js';

export type FactPublishGateFailureReason =
  | 'no_citations'
  | 'incomplete_citation'
  | 'not_a_publishable_status';

export type FactPublishGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: FactPublishGateFailureReason; readonly message: string };

/**
 * The statuses this gate applies to: a fact entering (or already in) `published`/`corrected`
 * must have complete citations. `draft`/`under_review` are exempt (still being assembled);
 * `superseded`/`deprecated` are exempt from a NEW completeness check (they keep whatever
 * citation set they had when superseded/deprecated — see `isPubliclyResolvableFactStatus`, which
 * governs a different concern: staying resolvable, not re-validating sourcing).
 */
const STATUSES_REQUIRING_CITATION_COMPLETENESS: readonly FactStatus[] = ['published', 'corrected'];

export function evaluateFactPublishGate(
  fact: Pick<FactRecord, 'citations' | 'status'>,
): FactPublishGateResult {
  if (!STATUSES_REQUIRING_CITATION_COMPLETENESS.includes(fact.status)) {
    return { ok: true };
  }
  if (fact.citations.length === 0) {
    return {
      ok: false,
      reason: 'no_citations',
      message: `FactRecord cannot reach status "${fact.status}" with zero citations. "Unsourced" is not a publishable state (BB-086).`,
    };
  }
  if (!hasCompleteFactCitations(fact)) {
    return {
      ok: false,
      reason: 'incomplete_citation',
      message:
        `FactRecord cannot reach status "${fact.status}": at least one citation is missing an ` +
        'archived-capture pointer (archivedUrl+archivedAt) or a retrieval date (accessedAt).',
    };
  }
  return { ok: true };
}

export function assertFactMayPublish(fact: Pick<FactRecord, 'id' | 'citations' | 'status'>): void {
  const result = evaluateFactPublishGate(fact);
  if (!result.ok) {
    throw new Error(`Fact ${fact.id} blocked from publishing: ${result.message}`);
  }
}

/**
 * Aggregates the publish gate across every fact slated for a projection build — mirrors
 * `../citations/completeness-gate.ts`'s `evaluateProjectionCitationCompleteness`, surfacing every
 * failing fact in one pass rather than stopping at the first.
 */
export function evaluateFactProjectionPublishGate(
  facts: readonly Pick<FactRecord, 'id' | 'citations' | 'status'>[],
): { readonly ok: true } | { readonly ok: false; readonly failures: readonly { readonly factId: string; readonly reason: FactPublishGateFailureReason }[] } {
  const failures: { readonly factId: string; readonly reason: FactPublishGateFailureReason }[] = [];
  for (const fact of facts) {
    const result = evaluateFactPublishGate(fact);
    if (!result.ok) {
      failures.push({ factId: fact.id, reason: result.reason });
    }
  }
  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export function assertFactProjectionPublishGate(
  facts: readonly Pick<FactRecord, 'id' | 'citations' | 'status'>[],
): void {
  const result = evaluateFactProjectionPublishGate(facts);
  if (!result.ok) {
    const ids = result.failures.map((f) => f.factId);
    throw new Error(
      `Projection build blocked: ${ids.length} fact(s) fail the publish gate (${ids.join(', ')}). ` +
        '"Unsourced" is not a publishable state (BB-086).',
    );
  }
}

/**
 * AC1: `deprecated`/`superseded` facts must stay resolvable with a banner — never 404. This is
 * the read-path counterpart to the write-path publish gate above: a fact viewer should call this
 * (or just `isPubliclyResolvableFactStatus` directly) to decide "render content + banner" vs.
 * "this status never had a public page in the first place" (draft/under_review).
 */
export function assertFactRemainsResolvable(fact: Pick<FactRecord, 'id' | 'status'>): void {
  if (!isPubliclyResolvableFactStatus(fact.status)) {
    throw new Error(
      `Fact ${fact.id} has status "${fact.status}", which has no public permalink — this is not a 404, ` +
        'it is a pre-publication record that was never public.',
    );
  }
}

/** AC5: whether a fact belongs in the BB-049 searchable library surface right now. */
export function isFactSearchIndexable(fact: Pick<FactRecord, 'status'>): boolean {
  return isSearchIndexableFactStatus(fact.status);
}

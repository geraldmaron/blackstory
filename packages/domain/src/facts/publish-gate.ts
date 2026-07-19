/**
 * Fail-closed publish gate for `FactRecord`.
 *
 * "Unsourced" is not a publishable state: a fact may only transition to `published`/`corrected`
 * when every citation is structurally complete AND every web citation carries an archived-capture
 * pointer (`archivedUrl` + `archivedAt`) and a retrieval date (`accessedAt`) see
 * `./citation.ts`. This mirrors `../citations/completeness-gate.ts`'s claim-level gate and
 * `../publication/index.ts`'s release-build discipline, applied to the fact registry's own
 * record shape.
 *
 * Not wired live: the projection-build pipeline (`workers/publication/`, per ADR-007) is
 * the intended caller. Call `assertFactMayPublish` immediately before including a fact in a
 * release/projection build and do not proceed if it throws.
 *
 * Independence of axes: this gate checks `status` transitions and citation completeness; it
 * never reads or derives `confidence` as a publish precondition. A `contested`-confidence fact
 * may publish (with its dispute disclosed via `confidenceNote`/`counterClaims`) exactly as
 * readily as an `established`-confidence one — confidence is a caveat, not a publish blocker.
 *
 * Derivation consistency (the related workstream): when a fact declares `derivedFromClaimIds`, this
 * gate ALSO cross-checks its citations/confidence against the named canonical claims via
 * `./derivation.ts`'s `evaluateFactDerivationConsistency` — see that module's doc comment for the
 * exact comparison rule. This is opt-in and additive, never a new hard requirement: a fact with
 * an empty `derivedFromClaimIds` (all pre-existing fact data today) is unaffected, and a caller
 * that does not supply `backingClaims` for a fact that HAS declared derivation ids fails the gate
 * closed rather than silently skipping the check (see `derivation.ts` for why).
 */
import { isSearchIndexableFactStatus, isPubliclyResolvableFactStatus, type FactStatus } from './status.js';
import { hasCompleteFactCitations, type FactRecord } from './record.js';
import { evaluateFactDerivationConsistency, type FactDerivationBackingClaim } from './derivation.js';

export type FactPublishGateFailureReason =
  | 'no_citations'
  | 'incomplete_citation'
  | 'not_a_publishable_status'
  | 'derivation_inconsistent';

/** Per-call options for the derivation-consistency sub-check; omit entirely (or leave
 * `backingClaims` unset) for a fact whose `derivedFromClaimIds` is empty. */
export type FactPublishGateOptions = {
  readonly backingClaims?: readonly FactDerivationBackingClaim[];
};

export type FactPublishGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: FactPublishGateFailureReason; readonly message: string };

/**
 * The statuses this gate applies to: a fact entering (or already in) `published`/`corrected`
 * must have complete citations. `draft`/`under_review` are exempt (still being assembled);
 * `superseded`/`deprecated` are exempt from a NEW completeness check (they keep whatever
 * citation set they had when superseded/deprecated see `isPubliclyResolvableFactStatus`, which
 * governs a different concern: staying resolvable, not re-validating sourcing).
 */
const STATUSES_REQUIRING_CITATION_COMPLETENESS: readonly FactStatus[] = ['published', 'corrected'];

export function evaluateFactPublishGate(
  fact: Pick<FactRecord, 'citations' | 'status'> &
    Partial<Pick<FactRecord, 'id' | 'derivedFromClaimIds' | 'confidence'>>,
  options: FactPublishGateOptions = {},
): FactPublishGateResult {
  if (!STATUSES_REQUIRING_CITATION_COMPLETENESS.includes(fact.status)) {
    return { ok: true };
  }
  if (fact.citations.length === 0) {
    return {
      ok: false,
      reason: 'no_citations',
      message: `FactRecord cannot reach status "${fact.status}" with zero citations. "Unsourced" is not a publishable state ().`,
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

  const derivedFromClaimIds = fact.derivedFromClaimIds ?? [];
  if (derivedFromClaimIds.length > 0 && fact.confidence !== undefined) {
    const derivation = evaluateFactDerivationConsistency({
      fact: {
        ...(fact.id !== undefined ? { id: fact.id } : {}),
        citations: fact.citations,
        confidence: fact.confidence,
        derivedFromClaimIds,
      },
      backingClaims: options.backingClaims ?? [],
    });
    if (!derivation.ok) {
      return { ok: false, reason: 'derivation_inconsistent', message: derivation.message };
    }
  }

  return { ok: true };
}

export function assertFactMayPublish(
  fact: Pick<FactRecord, 'id' | 'citations' | 'status'> &
    Partial<Pick<FactRecord, 'derivedFromClaimIds' | 'confidence'>>,
  options: FactPublishGateOptions = {},
): void {
  const result = evaluateFactPublishGate(fact, options);
  if (!result.ok) {
    throw new Error(`Fact ${fact.id} blocked from publishing: ${result.message}`);
  }
}

/** Per-projection-run options: `backingClaimsByFactId` supplies the canonical claims backing
 * each fact's `derivedFromClaimIds`, keyed by `FactRecord.id`, for the derivation-consistency
 * sub-check (see `./derivation.ts`). Facts with an empty `derivedFromClaimIds` need no entry. */
export type FactProjectionPublishGateOptions = {
  readonly backingClaimsByFactId?: ReadonlyMap<string, readonly FactDerivationBackingClaim[]>;
};

/**
 * Aggregates the publish gate across every fact slated for a projection build mirrors
 * `../citations/completeness-gate.ts`'s `evaluateProjectionCitationCompleteness`, surfacing every
 * failing fact in one pass rather than stopping at the first.
 */
export function evaluateFactProjectionPublishGate(
  facts: readonly (Pick<FactRecord, 'id' | 'citations' | 'status'> &
    Partial<Pick<FactRecord, 'derivedFromClaimIds' | 'confidence'>>)[],
  options: FactProjectionPublishGateOptions = {},
): { readonly ok: true } | { readonly ok: false; readonly failures: readonly { readonly factId: string; readonly reason: FactPublishGateFailureReason }[] } {
  const failures: { readonly factId: string; readonly reason: FactPublishGateFailureReason }[] = [];
  for (const fact of facts) {
    const backingClaims = options.backingClaimsByFactId?.get(fact.id);
    const result = evaluateFactPublishGate(fact, backingClaims !== undefined ? { backingClaims } : {});
    if (!result.ok) {
      failures.push({ factId: fact.id, reason: result.reason });
    }
  }
  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export function assertFactProjectionPublishGate(
  facts: readonly (Pick<FactRecord, 'id' | 'citations' | 'status'> &
    Partial<Pick<FactRecord, 'derivedFromClaimIds' | 'confidence'>>)[],
  options: FactProjectionPublishGateOptions = {},
): void {
  const result = evaluateFactProjectionPublishGate(facts, options);
  if (!result.ok) {
    const ids = result.failures.map((f) => f.factId);
    throw new Error(
      `Projection build blocked: ${ids.length} fact(s) fail the publish gate (${ids.join(', ')}). ` +
        '"Unsourced" is not a publishable state ().',
    );
  }
}

/**
 * `deprecated`/`superseded` facts must stay resolvable with a banner never 404. This is
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

/** whether a fact belongs in the searchable library surface right now. */
export function isFactSearchIndexable(fact: Pick<FactRecord, 'status'>): boolean {
  return isSearchIndexableFactStatus(fact.status);
}

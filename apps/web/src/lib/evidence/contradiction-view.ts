/**
 * Dispute/contradiction presentation for the BB-053 evidence interface (AC3: disagreement is
 * visible rather than silently resolved).
 *
 * Normalizes either the seed-depth `disputed`/`disputeNote` shape (mirroring
 * `apps/web/src/data/public-seed.ts`'s `PublicClaimView`) or a richer BB-017 `ContradictionSet`
 * (`@black-book/domain`'s `preserveContradictoryValues` output) into one `EvidenceDisputeView` \u2014
 * every credible alternate value is always retained in the view model, never collapsed down to a
 * single answer.
 */
import type { ContradictionSet } from '@black-book/domain';
import type { EvidenceAlternateValue, EvidenceDisputeInput, EvidenceDisputeView } from './types.js';

export function buildDisputeView(input: EvidenceDisputeInput): EvidenceDisputeView {
  const alternates = input.alternates ?? [];
  return {
    hasDispute: Boolean(input.disputed) || alternates.length > 0,
    primaryValue: input.primaryValue,
    ...(input.disputeNote ? { note: input.disputeNote } : {}),
    alternates,
  };
}

/** Adapt a full BB-017 `ContradictionSet` (richer than the seed shape) into the same view,
 * preserving every non-primary value \u2014 contradicting and alternative alike. */
export function buildDisputeViewFromContradictionSet(set: ContradictionSet): EvidenceDisputeView {
  const alternates: EvidenceAlternateValue[] = set.values
    .filter((value) => value.kind !== 'primary')
    .map((value) => ({
      value: value.value,
      credible: value.credible,
      kind: value.kind === 'contradicting' ? 'contradicting' : 'alternative',
    }));

  return {
    hasDispute: set.hasCredibleContradiction || alternates.length > 0,
    primaryValue: set.primaryValue,
    alternates,
  };
}

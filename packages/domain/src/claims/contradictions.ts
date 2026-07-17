/**
 * Contradiction preservation for credible alternate claim values (BB-017).
 * Contradictory credible values are retained rather than silently resolved.
 */
import type { PreservedClaimValue } from './claim.js';
import type { ClaimEvidenceLink } from './evidence-link.js';

export type ContradictionSet = {
  readonly claimId: string;
  readonly primaryValue: string;
  readonly values: readonly PreservedClaimValue[];
  /** True when at least one credible contradicting value differs from primary. */
  readonly hasCredibleContradiction: boolean;
};

/**
 * Build the preserved-value set for a claim version.
 * Primary object is always kept; credible contradicting/alternative values are never dropped.
 */
export function preserveContradictoryValues(input: {
  readonly claimId: string;
  readonly primaryValue: string;
  readonly evidenceLinks: readonly ClaimEvidenceLink[];
}): ContradictionSet {
  const primary: PreservedClaimValue = {
    value: input.primaryValue,
    evidenceLinkIds: input.evidenceLinks
      .filter((l) => l.role === 'supporting' && (l.assertedValue ?? input.primaryValue) === input.primaryValue)
      .map((l) => l.id),
    credible: true,
    kind: 'primary',
  };

  const byValue = new Map<string, PreservedClaimValue>();
  byValue.set(input.primaryValue, primary);

  for (const link of input.evidenceLinks) {
    const value = link.assertedValue?.trim();
    if (!value) continue;

    if (link.role === 'contradicting') {
      const existing = byValue.get(value);
      if (existing && existing.kind !== 'primary') {
        byValue.set(value, {
          ...existing,
          credible: existing.credible || link.credible,
          evidenceLinkIds: [...new Set([...existing.evidenceLinkIds, link.id])],
          kind: 'contradicting',
        });
      } else if (!existing || existing.kind === 'primary') {
        // Do not overwrite primary; store as contradicting even if text matches (dispute marker).
        if (value === input.primaryValue) {
          continue;
        }
        byValue.set(value, {
          value,
          evidenceLinkIds: [link.id],
          credible: link.credible,
          kind: 'contradicting',
        });
      }
      continue;
    }

    if (link.role === 'supporting' && value !== input.primaryValue) {
      const existing = byValue.get(value);
      if (existing && existing.kind !== 'primary') {
        byValue.set(value, {
          ...existing,
          credible: existing.credible || link.credible,
          evidenceLinkIds: [...new Set([...existing.evidenceLinkIds, link.id])],
        });
      } else if (!existing) {
        byValue.set(value, {
          value,
          evidenceLinkIds: [link.id],
          credible: link.credible,
          kind: 'alternative',
        });
      }
    }
  }

  const values = [...byValue.values()].sort((a, b) => {
    const order = { primary: 0, contradicting: 1, alternative: 2 } as const;
    const kindDelta = order[a.kind] - order[b.kind];
    return kindDelta !== 0 ? kindDelta : a.value.localeCompare(b.value);
  });

  const hasCredibleContradiction = values.some(
    (v) => v.kind === 'contradicting' && v.credible && v.value !== input.primaryValue,
  );

  return {
    claimId: input.claimId,
    primaryValue: input.primaryValue,
    values,
    hasCredibleContradiction,
  };
}

/** Guard: never collapse a contradiction set down to a single value when credible disputes exist. */
export function assertContradictionsPreserved(set: ContradictionSet): void {
  if (set.hasCredibleContradiction) {
    const contradicting = set.values.filter((v) => v.kind === 'contradicting' && v.credible);
    if (contradicting.length === 0) {
      throw new Error('Credible contradictions must remain in preserved values');
    }
  }
  const primary = set.values.find((v) => v.kind === 'primary');
  if (!primary || primary.value !== set.primaryValue) {
    throw new Error('Primary claim value must be preserved');
  }
}

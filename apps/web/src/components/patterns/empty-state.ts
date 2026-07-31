/**
 * Empty-state copy for the Atlas lens.
 *
 * An empty result set is a fact about the reader's filters, not about the archive. The copy has to
 * name the cause and offer the specific loosening that would refill the view, because a bare
 * "no results" invites the reader to conclude the record does not exist.
 *
 * Pure so the copy is testable without rendering. See docs/ui/design-direction-v9-atlas.md §7.
 */

export type LensConstraints = {
  readonly evidenceFloor?: string | undefined;
  readonly decade?: string | undefined;
  readonly state?: string | undefined;
  readonly kind?: string | undefined;
  readonly query?: string | undefined;
};

export type EmptyStateCopy = {
  readonly cause: string;
  readonly fix: string;
  /** Labels the reset control. Absent when there is no lens to reset. */
  readonly resetLabel?: string;
};

/** Loosening suggestions, ordered by how much of the archive each one gives back. */
const LOOSENINGS: ReadonlyArray<{
  readonly key: keyof LensConstraints;
  readonly fix: string;
}> = [
  { key: 'query', fix: 'shorten the search' },
  { key: 'evidenceFloor', fix: 'widen the evidence floor' },
  { key: 'decade', fix: 'clear the decade' },
  { key: 'kind', fix: 'add another kind' },
  { key: 'state', fix: 'widen to the whole country' },
];

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function emptyStateCopy(constraints: LensConstraints): EmptyStateCopy {
  const active = LOOSENINGS.filter((entry) => Boolean(constraints[entry.key]));

  if (active.length === 0) {
    // Nothing is filtered and the view is still empty, so the honest cause is loading or an
    // upstream failure, not the reader's lens. Never blame a lens the reader did not set.
    return {
      cause: 'No records loaded yet.',
      fix: 'If this persists, the archive may be unreachable from here.',
    };
  }

  // Name the two loosenings that give back the most, rather than listing every active filter.
  const [first, second] = active;
  const fix = second
    ? `${sentenceCase(first!.fix)} or ${second.fix}.`
    : `${sentenceCase(first!.fix)}.`;

  return {
    cause: 'No records match this lens.',
    fix,
    resetLabel: 'Reset lens',
  };
}

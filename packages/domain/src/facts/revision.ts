/**
 * Append-only `FactRecord.revisions[]` (BB-086 acceptance criteria 3 & 7).
 *
 * PROV-O naming (per BB-086's design note, so a future RDF export is mechanical): a `FactRevision`
 * is a PROV-O `Activity` (`wasRevisionOf` the prior revision, transitively the `Entity` — the
 * `FactRecord` itself); `agent` is a PROV-O `Agent` (`wasAssociatedWith` the activity). This
 * module does not depend on an RDF library — it just keeps the field names and relationships
 * PROV-O-shaped so a later exporter has no renaming to do.
 *
 * `changeType` uses the PolitiFact taxonomy named in the bead (correction | clarification |
 * update | style). Every revision requires a non-empty `summary` — mandatory edit summaries are
 * the whole point of an append-only revision log; a revision with no stated reason is as bad as
 * no revision log at all.
 */

export const FACT_REVISION_CHANGE_TYPES = ['correction', 'clarification', 'update', 'style'] as const;
export type FactRevisionChangeType = (typeof FACT_REVISION_CHANGE_TYPES)[number];

export function isFactRevisionChangeType(value: string): value is FactRevisionChangeType {
  return (FACT_REVISION_CHANGE_TYPES as readonly string[]).includes(value);
}

/** PROV-O `Agent` — the actor responsible for the revision `Activity`. */
export type FactRevisionAgent = {
  readonly id: string;
  readonly type: 'user' | 'service' | 'system';
  readonly displayName?: string;
};

/** One field-level change within a revision's diff, structured rather than a raw text blob. */
export type FactRevisionDiffEntry = {
  readonly field: string;
  readonly before: string | null;
  readonly after: string | null;
};

export type FactRevision = {
  readonly revisionNumber: number;
  readonly timestamp: string;
  readonly agent: FactRevisionAgent;
  readonly changeType: FactRevisionChangeType;
  /** Mandatory edit summary — never empty (BB-086 AC3/AC7). */
  readonly summary: string;
  readonly diff: readonly FactRevisionDiffEntry[];
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertFactRevisionValid(revision: FactRevision): void {
  if (!Number.isInteger(revision.revisionNumber) || revision.revisionNumber < 1) {
    throw new Error('FactRevision.revisionNumber must be a positive integer');
  }
  if (!Number.isFinite(Date.parse(revision.timestamp))) {
    throw new Error('FactRevision.timestamp must be a valid ISO date');
  }
  if (!isNonEmpty(revision.agent.id)) {
    throw new Error('FactRevision.agent.id must be non-empty');
  }
  if (!isFactRevisionChangeType(revision.changeType)) {
    throw new Error(`Unknown FactRevision.changeType "${revision.changeType}"`);
  }
  if (!isNonEmpty(revision.summary)) {
    throw new Error('FactRevision.summary (mandatory edit summary) must be non-empty');
  }
}

/**
 * Fail-closed append-only invariant: revision numbers must be a gapless 1..N sequence in
 * ascending order, and every revision already recorded in `previous` must remain byte-identical
 * in `next` (an append-only log that could silently rewrite history is not append-only). This is
 * the structural proof of "append-only" — not just a naming convention.
 */
export function assertRevisionsAppendOnly(
  previous: readonly FactRevision[],
  next: readonly FactRevision[],
): void {
  if (next.length < previous.length) {
    throw new Error('FactRecord revisions[] must never shrink (append-only)');
  }
  for (let i = 0; i < previous.length; i += 1) {
    if (JSON.stringify(previous[i]) !== JSON.stringify(next[i])) {
      throw new Error(`FactRecord revision #${previous[i]!.revisionNumber} was mutated — append-only violation`);
    }
  }
  next.forEach((revision, index) => {
    assertFactRevisionValid(revision);
    if (revision.revisionNumber !== index + 1) {
      throw new Error(
        `FactRecord revisions[] must be a gapless 1..N sequence (expected #${index + 1}, got #${revision.revisionNumber})`,
      );
    }
  });
}

/** Builds the next revision entry, appended by the caller to the existing `revisions[]`. */
export function buildNextRevision(input: {
  readonly previousRevisions: readonly FactRevision[];
  readonly timestamp: string;
  readonly agent: FactRevisionAgent;
  readonly changeType: FactRevisionChangeType;
  readonly summary: string;
  readonly diff: readonly FactRevisionDiffEntry[];
}): FactRevision {
  const revision: FactRevision = {
    revisionNumber: input.previousRevisions.length + 1,
    timestamp: input.timestamp,
    agent: input.agent,
    changeType: input.changeType,
    summary: input.summary,
    diff: input.diff,
  };
  assertFactRevisionValid(revision);
  return revision;
}

/** The current (highest-numbered) revision, or `undefined` for a fact with no recorded revisions. */
export function currentFactRevision(revisions: readonly FactRevision[]): FactRevision | undefined {
  return revisions.length === 0 ? undefined : revisions[revisions.length - 1];
}

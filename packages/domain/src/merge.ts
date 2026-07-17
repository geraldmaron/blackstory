/**
 * Duplicate detection and reversible, audited entity merge lineage (BB-014).
 */
export type EntityMergeStatus = 'active' | 'reversed';

export type EntityMergeRecord = {
  readonly id: string;
  /** Canonical survivor after merge. */
  readonly survivorId: string;
  /** Entity ids absorbed into the survivor. */
  readonly absorbedIds: readonly string[];
  readonly status: EntityMergeStatus;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly createdAt: string;
  readonly createdBy: string;
  readonly reversedAt?: string;
  readonly reversedBy?: string;
  readonly reverseReason?: string;
  /** Audit event ids written for this merge / reverse. */
  readonly auditEventIds: readonly string[];
};

export function assertMergeReversible(merge: EntityMergeRecord): void {
  if (merge.status !== 'active') {
    throw new Error(`Merge ${merge.id} is not active (status=${merge.status})`);
  }
  if (!merge.survivorId || merge.absorbedIds.length === 0) {
    throw new Error(`Merge ${merge.id} is missing survivor or absorbed ids`);
  }
  if (merge.absorbedIds.includes(merge.survivorId)) {
    throw new Error(`Merge ${merge.id} cannot absorb its own survivor`);
  }
}

/**
 * Produce a reversed merge record. Callers must restore absorbed entities to active
 * and append an audit event (BB-018 deepens outbox).
 */
export function reverseMerge(
  merge: EntityMergeRecord,
  options: { reversedBy: string; reverseReason: string; reversedAt: string; auditEventId: string },
): EntityMergeRecord {
  assertMergeReversible(merge);
  return {
    ...merge,
    status: 'reversed',
    reversedAt: options.reversedAt,
    reversedBy: options.reversedBy,
    reverseReason: options.reverseReason,
    auditEventIds: [...merge.auditEventIds, options.auditEventId],
  };
}

export function isMergeActive(merge: EntityMergeRecord): boolean {
  return merge.status === 'active';
}

/**
 * Pure rules for entity merges. No database, no request — the SQL lives in `entity-merge.ts`.
 *
 * The governing rule for the whole merge is stated once, here, because every statement in
 * `entity-merge.ts` is an expression of it:
 *
 *   **A merge moves rows. It never deletes them.**
 *
 * When a row cannot move cleanly — because it would collide with a row the survivor already
 * owns, or because both of its endpoints would become the survivor — it stays on the absorbed
 * entity instead. The absorbed row is soft-marked, not deleted, so a row left behind is still
 * reachable and still means what it meant. That is what makes the merge reversible: reversal is
 * the same repointing run backwards over a recorded list of row ids, and there is nothing
 * destroyed that a reversal would have to reconstruct.
 *
 * The existing ops script (`packages/ops-data/scripts/merge-duplicate-hubs.ts`) resolves the same
 * collisions by deleting the losing rows, which is fine for a reviewed one-off but is not
 * something an operator should be able to trigger from a console with no way back.
 */

/** More than this in one merge is almost certainly a mis-selection, not a dedupe. */
export const MAX_ABSORBED_PER_MERGE = 25;

export type MergePlan = {
  readonly survivorId: string;
  readonly absorbedIds: readonly string[];
};

export type MergePlanResult =
  | { readonly status: 'ok'; readonly plan: MergePlan }
  | { readonly status: 'invalid'; readonly message: string };

/**
 * Normalize and check a survivor/absorbed selection before anything touches the database.
 * Duplicates in the absorbed list are collapsed; the survivor appearing in it is an error rather
 * than something to silently drop, because it means the operator picked the wrong radio button.
 */
export function planMerge(survivorId: string, absorbedIds: readonly string[]): MergePlanResult {
  const survivor = survivorId.trim();
  if (!survivor) {
    return { status: 'invalid', message: 'Choose which record survives the merge.' };
  }

  const absorbed = [...new Set(absorbedIds.map((id) => id.trim()).filter(Boolean))];
  if (absorbed.length === 0) {
    return { status: 'invalid', message: 'Choose at least one record to merge into the survivor.' };
  }
  if (absorbed.includes(survivor)) {
    return {
      status: 'invalid',
      message: 'The survivor cannot also be absorbed — clear it from the list of records to merge.',
    };
  }
  if (absorbed.length > MAX_ABSORBED_PER_MERGE) {
    return {
      status: 'invalid',
      message: `A single merge absorbs at most ${MAX_ABSORBED_PER_MERGE} records; ${absorbed.length} were selected.`,
    };
  }

  return { status: 'ok', plan: { survivorId: survivor, absorbedIds: absorbed } };
}

/** The tables a merge repoints, in the order they are rewritten. */
export const MERGE_TABLES = [
  'entity_relationships',
  'event_participation',
  'claims',
  'entity_identifiers',
  'entity_locations',
  'entity_aliases',
  'entity_embeddings',
  'entity_reconciliation_status',
] as const;

export type MergeTable = (typeof MERGE_TABLES)[number];

/** One row that moved, with where it came from, so reversal knows where to put it back. */
export type MovedRow = {
  readonly id: string;
  /** The absorbed entity this row belonged to. For relationships/participation, the endpoints. */
  readonly from: Readonly<Record<string, string>>;
};

export type MergeTableOutcome = {
  readonly moved: readonly MovedRow[];
  /** Rows that stayed on the absorbed record, with the reason a human can act on. */
  readonly leftBehind: readonly { readonly id: string; readonly reason: string }[];
};

/**
 * Everything needed to undo the merge, recorded on the audit event. Reversal reads this rather
 * than re-deriving anything, so a row that has since been edited still goes back where it came
 * from, and a row that has since been deleted simply does not come back rather than erroring.
 */
export type MergeReversalRecord = {
  readonly mergeId: string;
  readonly survivorId: string;
  readonly absorbedIds: readonly string[];
  readonly tables: Readonly<Partial<Record<MergeTable, MergeTableOutcome>>>;
};

export function countMoved(record: MergeReversalRecord): number {
  return Object.values(record.tables).reduce((total, outcome) => total + outcome.moved.length, 0);
}

export function countLeftBehind(record: MergeReversalRecord): number {
  return Object.values(record.tables).reduce(
    (total, outcome) => total + outcome.leftBehind.length,
    0,
  );
}

/**
 * Merge ledger id. Derived from the audit event id so the ledger row, the audit event, and the
 * outbox message all point at each other without a second source of identity.
 */
export function mergeLedgerIdFor(eventId: string): string {
  return `merge_admin_${eventId.replace(/-/g, '').slice(0, 24)}`;
}

export function buildMergeState(
  survivorId: string,
  mergeId: string,
  absorbedAt: string,
  reason: string,
): Readonly<Record<string, unknown>> {
  return { status: 'absorbed', survivorId, mergeId, absorbedAt, reason };
}

/**
 * A one-line summary for the audit event and the operator's confirmation, e.g.
 * "3 records absorbed into ent_x — 41 rows moved, 2 left behind".
 */
export function describeMerge(record: MergeReversalRecord): string {
  const moved = countMoved(record);
  const left = countLeftBehind(record);
  const absorbed = record.absorbedIds.length;
  return (
    `${absorbed} record${absorbed === 1 ? '' : 's'} absorbed into ${record.survivorId} — ` +
    `${moved} row${moved === 1 ? '' : 's'} moved` +
    (left > 0 ? `, ${left} left behind` : '')
  );
}

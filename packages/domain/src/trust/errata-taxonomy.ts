/**
 * Public errata change taxonomy PolitiFact four-way classification for the reverse-
 * chronological errata log. Distinct from `FactRevision.changeType` in `../facts/revision.ts`,
 * which uses `style` for cosmetic edits; errata entries use `editors_note` for editorial framing
 * that does not change the underlying fact statement.
 */

export const ERRATA_CHANGE_TYPES = [
  'correction',
  'clarification',
  'update',
  'editors_note',
] as const;

export type ErrataChangeType = (typeof ERRATA_CHANGE_TYPES)[number];

export function isErrataChangeType(value: string): value is ErrataChangeType {
  return (ERRATA_CHANGE_TYPES as readonly string[]).includes(value);
}

/** Human-facing labels for the errata log and RSS feed. */
export const ERRATA_CHANGE_TYPE_LABELS: Readonly<Record<ErrataChangeType, string>> = {
  correction: 'Correction',
  clarification: 'Clarification',
  update: 'Update',
  editors_note: "Editor's note",
};

/**
 * Maps a fact-revision `changeType` to the errata taxonomy when the revision appears in the
 * public errata log. `style` revisions become `editors_note`; unknown values fail closed.
 */
export function errataTypeFromFactRevisionChangeType(changeType: string): ErrataChangeType {
  if (changeType === 'style') {
    return 'editors_note';
  }
  if (isErrataChangeType(changeType)) {
    return changeType;
  }
  throw new Error(`Cannot map fact revision changeType "${changeType}" to errata taxonomy`);
}

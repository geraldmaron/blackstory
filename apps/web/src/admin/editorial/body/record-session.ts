/**
 * What this browser session has learned about records from the `@` menu and Record search, so
 * the editor can warn about a link to a record that is not public yet. A record the writer
 * never searched for is unknown here, and unknown is never flagged.
 */
export type RecordHit = {
  readonly id: string;
  readonly display_name: string;
  readonly kind: string | null;
  readonly place: string | null;
  readonly published: boolean;
};

const known = new Map<string, boolean>();

/** A record label sits inside `[[id|label]]`, so the characters that grammar uses are removed. */
export const safeLabel = (label: string) =>
  label
    .replace(/[[\]|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function rememberRecords(hits: readonly Pick<RecordHit, 'id' | 'published'>[]): void {
  for (const hit of hits) known.set(hit.id, hit.published === true);
}

export function unpublishedRecordIds(): ReadonlySet<string> {
  return new Set([...known].filter(([, published]) => !published).map(([id]) => id));
}

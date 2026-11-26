/**
 * The incremental publisher decides what to write from reads it makes before its transaction.
 * Inside the transaction it reads the same rows again under lock; this names the ids whose rows
 * changed in between, so the run can stop instead of writing over a newer correction or past a
 * retraction recorded mid-run.
 */
export function changedRowIds<Row extends { readonly entity_id: string }>(
  ids: readonly string[],
  before: readonly Row[],
  after: readonly Row[],
): string[] {
  const snapshot = (rows: readonly Row[]) =>
    new Map(rows.map((row) => [row.entity_id, JSON.stringify(row)] as const));
  const was = snapshot(before);
  const now = snapshot(after);
  return [...new Set(ids)].filter((id) => was.get(id) !== now.get(id));
}

'use server';

/**
 * Bulk field edits across a selected set of canonical entities.
 *
 * The whole set changes in one statement inside one audited transaction, so 5 rows and 5,000 rows
 * cost the same and either all land or none do. The values being overwritten are read first and
 * recorded on the audit event grouped by value, which is what makes a mistaken bulk edit
 * recoverable: the log says which ids were `institution` before someone made them `organization`.
 */
import { revalidatePath } from 'next/cache';
import { SENSITIVITY_CLASSES } from '@repo/domain';
import { commitCanonicalWrite } from '@/lib/canonical-write';
import {
  bulkBeforeStatement,
  bulkUpdateStatement,
  bulkVerbFor,
  checkBulkIds,
  describeBulkEdit,
  parseBulkEdit,
  type BulkField,
} from '@/lib/entity-bulk-edit';
import type { BulkEditState } from './bulk-state';

export async function applyBulkEdit(
  _previous: BulkEditState,
  formData: FormData,
): Promise<BulkEditState> {
  const field = String(formData.get('field') ?? '') as BulkField;
  const value = String(formData.get('value') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const ids = String(formData.get('entityIds') ?? '')
    .split(',')
    .map((id) => id.trim());
  const sensitivity = formData.getAll('sensitivity').map((entry) => String(entry));

  const checked = checkBulkIds(ids);
  if (!checked.ok) {
    return { status: 'error', message: checked.message };
  }

  const parsed = parseBulkEdit(field, value, SENSITIVITY_CLASSES, sensitivity);
  if (!parsed.ok) {
    return { status: 'error', message: parsed.message };
  }
  const { edit } = parsed;

  let changed = 0;
  let skipped = 0;

  const result = await commitCanonicalWrite({
    verb: bulkVerbFor(field),
    // The subject is the set, not a member of it.
    subjectId: `bulk:${field}:${checked.ids.length}`,
    reason,
    affectedCount: checked.ids.length,
    data: { field, after: describeBulkEdit(edit), selectedCount: checked.ids.length },
    async applyState(client) {
      const before = bulkBeforeStatement(checked.ids, field);
      const beforeRows = await client.query<{ value: string | null; ids: string[] }>(before.sql, [
        ...before.params,
      ]);

      const update = bulkUpdateStatement(checked.ids, edit);
      const updated = await client.query<{ id: string }>(update.sql, [...update.params]);
      changed = updated.rowCount ?? 0;
      skipped = checked.ids.length - changed;

      if (changed === 0) {
        // Rolls back the audit row with it: a log entry for a bulk edit that changed nothing
        // would be a claim that something happened.
        throw new Error(
          'None of the selected records changed — they may have been merged away or already hold this value.',
        );
      }

      return {
        // Grouped by prior value, so a thousand rows are one group of a thousand ids rather than
        // a thousand pairs. This is the record an un-do would read.
        before: beforeRows.rows.map((row) => ({ value: row.value, ids: row.ids })),
        changedCount: changed,
        skippedCount: skipped,
      };
    },
  });

  switch (result.status) {
    case 'ok':
      revalidatePath('/catalog');
      return {
        status: 'applied',
        changed,
        message:
          `Set ${describeBulkEdit(edit)} on ${changed.toLocaleString()} record${changed === 1 ? '' : 's'}.` +
          (skipped > 0
            ? ` ${skipped.toLocaleString()} were skipped — absorbed records are not edited.`
            : ''),
      };
    case 'unauthenticated':
      return { status: 'error', message: 'Your session expired. Sign in again to apply.' };
    case 'forbidden':
    case 'invalid':
    case 'failed':
      return { status: 'error', message: result.message };
  }
}

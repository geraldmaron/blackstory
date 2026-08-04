'use server';

/**
 * Inline field edits on a canonical entity.
 *
 * Every path here goes through `commitCanonicalWrite`, so the role check, the actor, and the
 * audit row are not this file's decision to make or skip. What this file adds is the before/after
 * pair: the current record is read inside the same request so the audit event says what the value
 * *was*, not just what it became.
 *
 * The operator id is never read from the form. It comes from the verified session, which is why
 * the form has no operator field for someone to change (unlike the older quick-add and evidence
 * actions, which still trust a posted operatorId).
 */
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { commitCanonicalWrite } from '@/lib/canonical-write';
import { readEntityDetail } from '@/lib/entity-detail';
import {
  afterValueFor,
  beforeValueFor,
  buildEditStatements,
  describeEdit,
  editValuesFromFormData,
  parseEntityFieldEdit,
} from '@/lib/entity-edit';
import type { EntityEditState } from './edit-state';

export async function saveEntityField(
  _previous: EntityEditState,
  formData: FormData,
): Promise<EntityEditState> {
  const entityId = String(formData.get('entityId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');

  if (!entityId) {
    return { status: 'error', message: 'Missing entity id.' };
  }

  const parsed = parseEntityFieldEdit(editValuesFromFormData(formData));
  if (!parsed.ok) {
    return { status: 'error', message: parsed.message };
  }
  const { edit } = parsed;

  const current = await readEntityDetail(entityId);
  if (!current) {
    return { status: 'error', message: 'That entity no longer exists.' };
  }

  const statements = buildEditStatements(entityId, edit, { newId: randomUUID() });

  const result = await commitCanonicalWrite({
    verb: 'entity.field_edit',
    subjectId: entityId,
    reason,
    data: {
      field: edit.field,
      before: beforeValueFor(edit, current),
      after: afterValueFor(edit),
    },
    async applyState(client) {
      for (const statement of statements) {
        const outcome = await client.query(statement.sql, [...statement.params]);
        if (statement.requireRowsElse && outcome.rowCount === 0) {
          // Throwing rolls the whole transaction back, audit row included — a refused edit must
          // not leave a log entry claiming it happened.
          throw new Error(statement.requireRowsElse);
        }
      }
    },
  });

  switch (result.status) {
    case 'ok':
      revalidatePath(`/catalog/${entityId}`);
      revalidatePath('/catalog');
      return {
        status: 'saved',
        message: result.replayed
          ? `No change — this ${describeEdit(edit)} edit was already recorded.`
          : `Saved ${describeEdit(edit)}.`,
        eventId: result.eventId,
      };
    case 'unauthenticated':
      return { status: 'error', message: 'Your session expired. Sign in again to save.' };
    case 'forbidden':
    case 'invalid':
    case 'failed':
      return { status: 'error', message: result.message };
  }
}

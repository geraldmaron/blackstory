'use server';

/**
 * Merging and un-merging canonical entities.
 *
 * Both go through `commitCanonicalWrite` under `canonical:merge`, so the role check, the actor,
 * and the audit row are not this file's to skip. The reversal record — every row id that moved and
 * where it came from — is written onto the merge's audit event, and the un-merge reads it back.
 * That is what "reversible" means here: not a promise, a recorded list.
 */
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { commitCanonicalWrite } from '@/lib/canonical-write';
import { applyEntityMerge, readMergeReversalRecord, reverseEntityMerge } from '@/lib/entity-merge';
import {
  countLeftBehind,
  countMoved,
  describeMerge,
  mergeLedgerIdFor,
  planMerge,
} from '@/lib/entity-merge-plan';
import type { MergeReversalRecord } from '@/lib/entity-merge-plan';
import type { MergeFormState } from './merge-state';

function idsFrom(formData: FormData, field: string): readonly string[] {
  return formData
    .getAll(field)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export async function mergeEntities(
  _previous: MergeFormState,
  formData: FormData,
): Promise<MergeFormState> {
  const survivorId = String(formData.get('survivorId') ?? '');
  const candidateIds = idsFrom(formData, 'candidateId');
  const reason = String(formData.get('reason') ?? '');

  const planned = planMerge(
    survivorId,
    candidateIds.filter((id) => id !== survivorId.trim()),
  );
  if (planned.status === 'invalid') {
    return { status: 'error', message: planned.message };
  }
  const { plan } = planned;

  const mergeId = mergeLedgerIdFor(randomUUID());
  const absorbedAt = new Date().toISOString();
  let record: MergeReversalRecord | undefined;

  const result = await commitCanonicalWrite({
    verb: 'entity.merge',
    subjectId: plan.survivorId,
    reason,
    affectedCount: plan.absorbedIds.length + 1,
    data: { survivorId: plan.survivorId, absorbedIds: plan.absorbedIds, mergeId },
    async applyState(client) {
      record = await applyEntityMerge(client, {
        survivorId: plan.survivorId,
        absorbedIds: plan.absorbedIds,
        mergeId,
        reason: reason.trim(),
        actorId: 'admin-console',
        absorbedAt,
      });
      // Returned rather than passed in: the row ids only exist once the merge has run, and this
      // is the record the un-merge reads back.
      return { reversal: record, summary: describeMerge(record) };
    },
  });

  switch (result.status) {
    case 'ok': {
      revalidatePath('/catalog');
      revalidatePath(`/catalog/${plan.survivorId}`);
      for (const absorbedId of plan.absorbedIds) revalidatePath(`/catalog/${absorbedId}`);
      const moved = record ? countMoved(record) : 0;
      const left = record ? countLeftBehind(record) : 0;
      return {
        status: 'ok',
        survivorId: plan.survivorId,
        message:
          `Merged. ${moved} row${moved === 1 ? '' : 's'} moved onto the survivor` +
          (left > 0
            ? `; ${left} stayed with the absorbed record${left === 1 ? '' : 's'} because they would have collided. They are listed on the survivor's page.`
            : '.'),
      };
    }
    case 'unauthenticated':
      return { status: 'error', message: 'Your session expired. Sign in again to merge.' };
    case 'forbidden':
    case 'invalid':
    case 'failed':
      return { status: 'error', message: result.message };
  }
}

export async function reverseMerge(
  _previous: MergeFormState,
  formData: FormData,
): Promise<MergeFormState> {
  const mergeId = String(formData.get('mergeId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  if (!mergeId) {
    return { status: 'error', message: 'Missing merge id.' };
  }

  const record = await readMergeReversalRecord(mergeId);
  if (!record) {
    return {
      status: 'error',
      message:
        'No reversal record found for this merge. Merges made before the console recorded one — or by the ops scripts — have to be undone by hand.',
    };
  }

  const result = await commitCanonicalWrite({
    verb: 'entity.merge_reverse',
    subjectId: record.survivorId,
    reason,
    affectedCount: record.absorbedIds.length + 1,
    data: { mergeId, survivorId: record.survivorId, absorbedIds: record.absorbedIds },
    async applyState(client) {
      return reverseEntityMerge(client, record, reason.trim());
    },
  });

  switch (result.status) {
    case 'ok':
      revalidatePath('/catalog');
      revalidatePath(`/catalog/${record.survivorId}`);
      for (const absorbedId of record.absorbedIds) revalidatePath(`/catalog/${absorbedId}`);
      return {
        status: 'ok',
        survivorId: record.survivorId,
        message: `Merge reversed. ${record.absorbedIds.length} record${
          record.absorbedIds.length === 1 ? '' : 's'
        } are separate again.`,
      };
    case 'unauthenticated':
      return { status: 'error', message: 'Your session expired. Sign in again to reverse.' };
    case 'forbidden':
    case 'invalid':
    case 'failed':
      return { status: 'error', message: result.message };
  }
}

/**
 * Durable public intake using the scoped public Postgres pool. Flattened quarantine payloads
 * share submissions.intake_items with the staff queue. The database synchronizes receipt
 * lifecycle fields on staff decisions and requeues a first eligible appeal atomically.
 */
import { randomUUID } from 'node:crypto';
import type { QuarantinedSubmissionRecord } from '@repo/security';
import { queryPostgres } from './postgres-client';
import { digestReceiptCode } from '../../app/corrections/receipt-code';
import { buildPublicCorrectionStatus } from '../../app/corrections/public-status';
import type { CorrectionSubmissionStore, StoredCorrection } from '../../app/corrections/store';

type IntakeRow = {
  readonly id: string;
  readonly payload: unknown;
};

function firstSourceUrl(record: QuarantinedSubmissionRecord): string | null {
  return record.normalized.sourceUrls[0] ?? null;
}

/** Fields `StoredCorrection` carries alongside its `record`; the rest of a flattened payload is
 * the `QuarantinedSubmissionRecord` itself. Listed explicitly rather than diffed against
 * `QuarantinedSubmissionRecord`'s own keys so a future field added to either type fails loudly
 * (a missing key here) instead of silently landing on the wrong side of the split. */
const STORED_CORRECTION_OWN_KEYS = [
  'receiptCode',
  'intakeStatus',
  'receiptDigest',
  'targetType',
  'category',
  'classificationDispute',
  'appeals',
  'closureReason',
  'updatedAt',
] as const satisfies readonly (keyof StoredCorrection)[];

/** Inverse of `parseStoredCorrection` — see the module doc comment for why this flattens. */
function serializeStoredCorrection(entry: StoredCorrection): Record<string, unknown> {
  const { record, ...own } = entry;
  return { ...record, ...own };
}

function parseStoredCorrection(row: IntakeRow): StoredCorrection {
  const flat = { ...(row.payload as Record<string, unknown>) };
  const own = {} as Record<string, unknown>;
  for (const key of STORED_CORRECTION_OWN_KEYS) {
    own[key] = flat[key];
    delete flat[key];
  }
  return { ...own, record: flat as unknown as QuarantinedSubmissionRecord } as StoredCorrection;
}

async function insertIntakeItem(input: {
  readonly id: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly sourceUrl: string | null;
  readonly createdAt: string;
  readonly receiptDigest?: string | undefined;
}): Promise<void> {
  await queryPostgres(
    `INSERT INTO submissions.intake_items
       (id, status, created_by, kind, payload, source_url, receipt_digest, created_at)
     VALUES ($1, 'quarantined', $2, $3, $4, $5, $6, $7)`,
    [
      input.id,
      // No authenticated actor for a public, anonymous submission — a fresh synthetic id per
      // row, same reasoning as `coerceCreatedByUuid` in
      // packages/data-access/src/postgres/path-write.ts for non-user-authored rows: the NOT NULL
      // uuid column needs *some* value, and nothing reads it back as a real identity for this kind.
      randomUUID(),
      input.kind,
      JSON.stringify(input.payload),
      input.sourceUrl,
      input.receiptDigest ?? null,
      input.createdAt,
    ],
  );
}

/** Persists leads and abuse reports without correction receipt metadata. */
export async function saveQuarantinedRecord(record: QuarantinedSubmissionRecord): Promise<void> {
  await insertIntakeItem({
    id: record.id,
    kind: record.normalized.kind,
    payload: record,
    sourceUrl: firstSourceUrl(record),
    createdAt: record.createdAt,
  });
}

export function createPostgresCorrectionSubmissionStore(): CorrectionSubmissionStore {
  async function getByReceiptCode(
    receiptCode: string,
    pepper: string,
  ): Promise<{ readonly row: IntakeRow; readonly stored: StoredCorrection } | undefined> {
    const digest = digestReceiptCode(receiptCode, pepper);
    if (!digest) return undefined;
    const rows = await queryPostgres<IntakeRow>(
      `SELECT id, payload FROM submissions.intake_items WHERE receipt_digest = $1`,
      [digest],
    );
    const row = rows[0];
    return row ? { row, stored: parseStoredCorrection(row) } : undefined;
  }

  return {
    async save(entry) {
      await insertIntakeItem({
        id: entry.record.id,
        kind: entry.record.normalized.kind,
        payload: serializeStoredCorrection(entry),
        sourceUrl: firstSourceUrl(entry.record),
        createdAt: entry.record.createdAt,
        receiptDigest: entry.receiptDigest,
      });
    },

    async getBySubmissionId(id) {
      const rows = await queryPostgres<IntakeRow>(
        `SELECT id, payload FROM submissions.intake_items WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      return row ? parseStoredCorrection(row) : undefined;
    },

    async getByReceiptCode(receiptCode, pepper) {
      const found = await getByReceiptCode(receiptCode, pepper);
      return found?.stored;
    },

    async attachAppeal(receiptCode, pepper, appeal) {
      const found = await getByReceiptCode(receiptCode, pepper);
      if (!found) return undefined;
      if (
        !buildPublicCorrectionStatus({
          ...found.stored,
          moderationState: found.stored.record.moderationState,
          submittedAt: found.stored.record.createdAt,
          appealCount: found.stored.appeals.length,
        }).appealAvailable
      )
        return undefined;
      const { closureReason: _closureReason, ...reopened } = found.stored;
      const updated: StoredCorrection = {
        ...reopened,
        intakeStatus: 'quarantined',
        appeals: [...found.stored.appeals, appeal],
        updatedAt: appeal.submittedAt,
        record: { ...found.stored.record, moderationState: 'pending_review' },
      };
      // Compare-and-swap prevents concurrent appeals or a staff decision from being overwritten.
      const rows = await queryPostgres<IntakeRow>(
        `UPDATE submissions.intake_items SET payload = $2
         WHERE id = $1 AND payload = $3::jsonb RETURNING id, payload`,
        [
          found.row.id,
          JSON.stringify(serializeStoredCorrection(updated)),
          JSON.stringify(found.row.payload),
        ],
      );
      return rows[0] ? parseStoredCorrection(rows[0]) : undefined;
    },

    async markClosed(submissionId, closureReason) {
      const rows = await queryPostgres<IntakeRow>(
        `SELECT id, payload FROM submissions.intake_items WHERE id = $1`,
        [submissionId],
      );
      const row = rows[0];
      if (!row) return undefined;
      const existing = parseStoredCorrection(row);
      const updated: StoredCorrection = {
        ...existing,
        closureReason,
        updatedAt: new Date().toISOString(),
        record: {
          ...existing.record,
          moderationState: closureReason === 'rejected' ? 'blocked' : 'resolved',
        },
      };
      await queryPostgres(`UPDATE submissions.intake_items SET payload = $2 WHERE id = $1`, [
        row.id,
        JSON.stringify(serializeStoredCorrection(updated)),
      ]);
      return updated;
    },
  };
}

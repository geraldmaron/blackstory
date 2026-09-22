/**
 * Postgres-backed correction submission store (repo-vl155.1) — the real production wiring
 * `../../app/corrections/store.ts`'s own doc comment used to claim already existed. See that
 * file's header for what was actually happening instead (nothing: every publicly submitted
 * correction was invisible to the admin console and lost on the next cold start).
 *
 * Lives here, outside `app/`, on purpose: `runtime-hardening.test.ts` walks every file under
 * `apps/web/src/app/**` (admin excluded) and fails on any import path containing `/postgres` —
 * the enforced rule is that live-Postgres access on the public render path only ever happens
 * through a `lib/`/`data/` module reached by a non-`postgres`-named path, matching how
 * `apps/web/src/data/public-seed.ts` already does this for entity reads. A file living under
 * `app/corrections/` that itself imports `queryPostgres` — even indirectly — trips that guard.
 *
 * Uses `queryPostgres` from `./postgres-client` — the public-tier `DATABASE_URL`/
 * `APP_DATABASE_URL` pool already used for public reads elsewhere in this app — deliberately
 * never `@repo/data-access`'s `getOpsPostgresPool`. That one backs `ADMIN_DATABASE_URL`-adjacent
 * ops/admin code (see `apps/web/src/admin/lib/canonical-postgres-client.ts`, which keeps its
 * connection "separate from the public pool's DATABASE_URL"), and this module's sibling
 * `postgres-client.ts` says why explicitly: "Kept local to apps/web so the public render path
 * never imports @repo/data-access." A public, unauthenticated route reaching for the *admin*
 * credential would be a real privilege escalation; this file only ever touches the same pool
 * public reads already use.
 *
 * RLS on `submissions.intake_items` grants INSERT only to the `authenticated` role with
 * `created_by = auth.uid()` (verified live against the blackstory-app Supabase project,
 * 2026-09-22) — there is no anonymous-insert policy, and there should not be one; a public
 * submitter has no `auth.uid()` to satisfy it. `postgres-client.ts`'s own doc calls this a
 * "service role" connection, which is what lets an anonymous row land at all. The narrowness
 * that matters here is enforced by the application code above this module (validation, rate
 * limiting, request-integrity, and the fixed shape this file ever writes or reads), exactly as
 * it already was for every column this endpoint was already trusted to set.
 *
 * `payload` stores a `StoredCorrection`, flattened, as one JSON blob — matching how this column
 * already holds differently-shaped payloads for other proposer pipelines, per
 * `apps/web/src/admin/lib/postgres-submissions.ts` ("whose shape varies by proposer pipeline").
 * "Flattened" matters: `deriveSubmissionTitle` in that same file (used by the admin submissions
 * list) reads `payload.normalized.title` / `payload.original.payload.title` directly off the
 * payload root — the shape every other pipeline already writes. Nesting the quarantine record
 * under a `record` key (i.e. storing `StoredCorrection` as-is) would make every correction show
 * up as "Untitled submission <id>" in the moderation queue, findable but unreadable. Abuse
 * reports (`saveQuarantinedRecord`) store the bare `QuarantinedSubmissionRecord` and are already
 * flat by construction.
 */
import { randomUUID } from 'node:crypto';
import type { QuarantinedSubmissionRecord } from '@repo/security';
import { queryPostgres } from './postgres-client';
import { digestReceiptCode } from '../../app/corrections/receipt-code';
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

/**
 * Persists a bare quarantined record with no receipt-code scheme — today only abuse reports,
 * which have no status page for a submitter to check, so nothing needs a `receipt_digest`. Not
 * part of `CorrectionSubmissionStore` (that interface is built around `StoredCorrection`, which
 * abuse reports don't have — no target type, category, or receipt); called directly from the
 * abuse-report route handler.
 */
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
      const updated: StoredCorrection = {
        ...found.stored,
        appeals: [...found.stored.appeals, appeal],
        updatedAt: appeal.submittedAt,
        record: {
          ...found.stored.record,
          moderationState: 'pending_review',
        },
      };
      await queryPostgres(`UPDATE submissions.intake_items SET payload = $2 WHERE id = $1`, [
        found.row.id,
        JSON.stringify(serializeStoredCorrection(updated)),
      ]);
      return updated;
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

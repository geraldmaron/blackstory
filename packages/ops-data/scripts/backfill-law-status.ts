/**
 * Item-level law and case status fixes with terminal or corrected status_history entries.
 *
 * Default dry-run. Apply:
 *   DRY_RUN=0 BACKFILL_LAW_STATUS_APPLY=1
 */
import pg from 'pg';
import { currentStatus } from '../../domain/src/entity-status.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  applyStatusFix,
  CASE_STATUS_FIXES,
  caseNeedsStatusReview,
  LAW_STATUS_FIXES,
} from './lib/status-backfill.ts';
import type { StatusHistoryEntry } from '../../domain/src/entity-status.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_LAW_STATUS_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type EntityRow = {
  readonly status_history: StatusHistoryEntry<string>[] | null;
  readonly kind_detail?: unknown;
};

async function applyFixes(
  client: pg.Client,
  fixes: readonly (typeof LAW_STATUS_FIXES)[number][],
  label: string,
): Promise<void> {
  for (const fix of fixes) {
    const { rows } = await client.query<EntityRow>(
      `SELECT status_history FROM bb_canonical.entities WHERE id = $1`,
      [fix.entityId],
    );
    const row = rows[0];
    if (!row) {
      console.log(`  SKIP missing ${fix.entityId}`);
      continue;
    }
    const nextHistory = applyStatusFix(row.status_history ?? [], fix);
    const current = currentStatus(nextHistory);
    console.log(
      `  ${label} ${fix.entityId}: ${fix.priorStatus} -> ${fix.nextStatus} (current open: ${current ?? 'none'}) — ${fix.note}`,
    );

    if (DRY_RUN || !APPLY) continue;

    await client.query(
      `UPDATE bb_canonical.entities
       SET status_history = $2::jsonb, updated_at = now()
       WHERE id = $1`,
      [fix.entityId, JSON.stringify(nextHistory)],
    );
    console.log(`  applied ${fix.entityId}`);
  }
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== backfill-law-status ===');
    console.log(`law fixes: ${LAW_STATUS_FIXES.length}, case fixes: ${CASE_STATUS_FIXES.length}`);

    await applyFixes(client, LAW_STATUS_FIXES, 'LAW');

    if (CASE_STATUS_FIXES.length > 0) {
      await applyFixes(client, CASE_STATUS_FIXES, 'CASE');
    }

    const { rows: gapLaws } = await client.query<{ id: string; display_name: string }>(
      `SELECT id, display_name
       FROM bb_canonical.entities
       WHERE kind = 'law'
         AND id LIKE 'gap_%'
         AND (status_history IS NULL OR jsonb_array_length(status_history) = 0)
       ORDER BY display_name`,
    );
    for (const row of gapLaws) {
      console.log(`  REVIEW gap law ${row.id} (${row.display_name}) — null status_history`);
    }

    const { rows: cases } = await client.query<{
      id: string;
      display_name: string;
      status_history: StatusHistoryEntry<string>[] | null;
      kind_detail: unknown;
    }>(
      `SELECT id, display_name, status_history, kind_detail
       FROM bb_canonical.entities
       WHERE kind = 'case'
       ORDER BY display_name`,
    );

    const fixedCaseIds = new Set(CASE_STATUS_FIXES.map((fix) => fix.entityId));
    let caseReviewCount = 0;
    for (const row of cases) {
      const open = currentStatus(row.status_history ?? undefined);
      if (!caseNeedsStatusReview({ entityId: row.id, openStatus: open, kindDetail: row.kind_detail })) {
        continue;
      }
      if (fixedCaseIds.has(row.id)) continue;
      caseReviewCount += 1;
      console.log(`  REVIEW case ${row.id} (${row.display_name}) — in_force vs summary demise language`);
    }
    if (caseReviewCount === 0) {
      console.log('  case review lane: no clear in_force + demise-language mismatches');
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_LAW_STATUS_APPLY=1 to apply.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

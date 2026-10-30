/**
 * One-time backfill: quarantined submissions whose research cases are all decided take the status
 * their cases earned. The operator approved this on 2026-10-29 (docs/plans/admin-footprint-
 * console.md, "Submission status backfill").
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && \
 *     node --conditions development --import tsx scripts/backfill-submission-status.mts [--write] [--limit N]
 *
 * Without --write it only reads and prints the counts. With --write, every row goes through
 * `commitSubmissionDecision`, the console's own decision path: one transaction per row with the
 * compare-and-set on current status, the audit event and the outbox message, so a row someone
 * decided in the meantime comes back `already_processed` and is left alone. The actor is a named
 * system identity rather than a person, because no one decided these rows by hand.
 *
 * Mapping (any case = any of the submission's cases):
 *   - a case is still open                         -> unchanged
 *   - a case reached minimum/partial/substantial    -> promote
 *   - otherwise a case was merged into a record     -> promote
 *   - every case was excluded                       -> reject
 * Story packets are skipped: their status follows the packet review, not the case.
 */
import { queryPostgres } from '../src/admin/lib/canonical-postgres-client.ts';
import {
  commitSubmissionDecision,
  type SubmissionDecision,
} from '../src/admin/lib/postgres-submissions.ts';

const SYSTEM_ACTOR = {
  uid: 'system:submission-status-backfill-2026-10-29',
  email: 'submission-status-backfill',
  role: 'admin' as const,
};

const REASON =
  'Backfill: submission status follows its research case outcome (operator-approved 2026-10-29).';

type Row = { readonly id: string; readonly target: 'promote' | 'reject' | 'unchanged' };

function refuseOutsideLocalDevelopment(): void {
  if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
    throw new Error('backfill-submission-status runs from a developer machine only.');
  }
}

function readLimit(): number | undefined {
  const index = process.argv.indexOf('--limit');
  if (index === -1) return undefined;
  const value = Number.parseInt(process.argv[index + 1] ?? '', 10);
  if (!Number.isFinite(value) || value < 1) throw new Error('--limit needs a positive number');
  return value;
}

async function readCandidates(): Promise<readonly Row[]> {
  return queryPostgres<Row>(
    `WITH q AS (
       SELECT i.id
         FROM submissions.intake_items i
        WHERE i.status = 'quarantined'
          -- coalesce: with no proposalKind the comparison is NULL, and NOT (NULL OR false)
          -- would silently drop the row instead of keeping it.
          AND NOT (coalesce(i.payload->>'proposalKind', '') = 'story_packet'
                   OR i.payload->'storyPacket' IS NOT NULL
                   OR coalesce(i.payload->>'statement', '') LIKE '%packetJson=%')
     ), agg AS (
       SELECT q.id,
              bool_or(c.state IN ('candidate','relevance_review','relevance_confirmed','insufficient_evidence')) AS any_open,
              bool_or(c.state IN ('minimum_record','partial_enrichment','substantial_enrichment')) AS any_enriched,
              bool_or(c.state = 'merged') AS any_merged,
              bool_and(c.state = 'excluded') AS all_excluded
         FROM q JOIN research.cases c ON c.candidate_id = q.id
        GROUP BY q.id
     )
     SELECT id,
            CASE WHEN any_open THEN 'unchanged'
                 WHEN any_enriched OR any_merged THEN 'promote'
                 WHEN all_excluded THEN 'reject'
                 ELSE 'unchanged' END AS target
       FROM agg
      ORDER BY id`,
  );
}

async function main(): Promise<void> {
  refuseOutsideLocalDevelopment();
  const write = process.argv.includes('--write');
  const limit = readLimit();

  const rows = await readCandidates();
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.target, (counts.get(row.target) ?? 0) + 1);
  console.log(`quarantined submissions with cases (story packets excluded): ${rows.length}`);
  for (const [target, count] of [...counts].sort()) console.log(`  ${target}: ${count}`);

  const toChange = rows.filter(
    (row): row is Row & { target: SubmissionDecision } => row.target !== 'unchanged',
  );
  console.log(`would change: ${toChange.length}`);
  if (!write) {
    console.log('dry run: nothing written. Rerun with --write to apply.');
    return;
  }

  const batch = limit ? toChange.slice(0, limit) : toChange;
  const results = new Map<string, number>();
  for (const [index, row] of batch.entries()) {
    const result = await commitSubmissionDecision(
      { intakeItemId: row.id, decision: row.target, reason: REASON },
      { readIdentity: async () => SYSTEM_ACTOR },
    );
    results.set(result.status, (results.get(result.status) ?? 0) + 1);
    if (result.status === 'failed') console.error(`failed ${row.id}: ${result.message}`);
    if ((index + 1) % 100 === 0) console.log(`  ${index + 1}/${batch.length}`);
  }
  console.log(`wrote ${batch.length} decisions:`);
  for (const [status, count] of [...results].sort()) console.log(`  ${status}: ${count}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

/**
 * Validate independent claim-review verdicts and, only when asked, write the reviewed chain.
 *
 * Claims and capture text are rebuilt from the database inside the transaction; the packets file
 * supplies entity ids only. Verdicts must match the current packetHash and name the recorded
 * reviewer, and every approval must quote its capture verbatim (lib/claim-review-ledger.ts).
 * Rejections are recorded as 'reject' review decisions; refused (invalid) verdicts write nothing.
 *
 * Default is dry-run (READ ONLY transaction). Writes need DRY_RUN=0 and CLAIM_REVIEW_APPLY=1 plus
 * the reviewer's identity, which must not be the producer's:
 *   CLAIM_REVIEW_REVIEWER_ACTOR_ID      e.g. codex-review:gpt-6.1-sol (session-claim-review-codex.ts)
 *   CLAIM_REVIEW_REVIEWER_MODEL_FAMILY  e.g. openai
 * Each record runs in its own transaction on a login holding claim_reviewer, --concurrency at a
 * time (default 4), and rolls back unless the publisher's own gate SQL accepts every claim version
 * written for it. Records are independent in the ledger, so a record that fails rolls back alone:
 * its claims are reported as refused and the batch runner holds that record, not the whole batch.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/session-claim-review-apply.ts \
 *     --packets-file=<dir>/packets.jsonl --verdicts-file=<dir>/verdicts.jsonl [--concurrency=4]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import { mapPool } from '../../operator-cli/src/map-pool.ts';
import { runClaimReview, type ClaimReviewReport, type Verdict } from './lib/claim-review-ledger.ts';

const WRITE = process.env.DRY_RUN === '0' && process.env.CLAIM_REVIEW_APPLY === '1';

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback === undefined) throw new Error(`--${name}= is required`);
  return fallback;
}

/** Concatenate per-record reports in record order. */
export function mergeReports(reports: readonly ClaimReviewReport[]): ClaimReviewReport {
  return {
    approved: reports.flatMap((report) => report.approved),
    rejected: reports.flatMap((report) => report.rejected),
    refused: reports.flatMap((report) => report.refused),
    written: reports.flatMap((report) => report.written),
    publishable: reports.flatMap((report) => report.publishable),
  };
}

/**
 * Split verdicts by the record their packet belongs to. A verdict whose packet id is in no packet
 * goes to the first record, where runClaimReview refuses it as "no current packet with this id".
 */
export function verdictsByEntity(
  packets: readonly { packetId: string; entityId: string }[],
  verdicts: readonly Verdict[],
): Map<string, Verdict[]> {
  const entityOf = new Map(packets.map((packet) => [packet.packetId, packet.entityId]));
  const out = new Map<string, Verdict[]>(packets.map((packet) => [packet.entityId, []]));
  const fallback = packets[0]?.entityId;
  for (const verdict of verdicts) {
    const entityId = entityOf.get(verdict.packetId) ?? fallback;
    if (entityId !== undefined) out.get(entityId)!.push(verdict);
  }
  return out;
}

const jsonl = (path: string): Record<string, unknown>[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);

async function main(): Promise<void> {
  const packets = jsonl(flag('packets-file')).map((packet) => ({
    packetId: String(packet.packetId),
    entityId: String(packet.entityId),
  }));
  const verdicts = jsonl(flag('verdicts-file')) as unknown as Verdict[];
  const concurrency = Number(flag('concurrency', '4'));
  const reviewer = {
    actorId: process.env.CLAIM_REVIEW_REVIEWER_ACTOR_ID?.trim() ?? '',
    modelFamily: process.env.CLAIM_REVIEW_REVIEWER_MODEL_FAMILY?.trim() ?? '',
  };
  if (WRITE && (!reviewer.actorId || !reviewer.modelFamily)) {
    throw new Error(
      'Writes need CLAIM_REVIEW_REVIEWER_ACTOR_ID and CLAIM_REVIEW_REVIEWER_MODEL_FAMILY',
    );
  }
  if (!reviewer.actorId) reviewer.actorId = 'dry-run-unspecified-reviewer';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool({
    ...normalizePgConnectionString(databaseUrl),
    max: Math.max(1, concurrency),
  });
  const byEntity = [...verdictsByEntity(packets, verdicts)];
  try {
    const reports = await mapPool(
      byEntity,
      async ([entityId, entityVerdicts]) => {
        const client = await connectWithDeadline<pg.PoolClient>(pool);
        try {
          await client.query(WRITE ? 'BEGIN' : 'BEGIN READ ONLY');
          const report = await runClaimReview(client, {
            entityIds: [entityId],
            verdicts: entityVerdicts,
            reviewer,
            write: WRITE,
          });
          await client.query(WRITE ? 'COMMIT' : 'ROLLBACK');
          return report;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          // This record alone rolls back; its claims come back refused so the runner holds it.
          const message = `record ${entityId} rolled back: ${String(error)}`;
          console.error(message);
          return mergeReports([
            {
              approved: [],
              rejected: [],
              refused: entityVerdicts.map((verdict) => ({
                packetId: verdict.packetId,
                errors: [message],
              })),
              written: [],
              publishable: [],
            },
          ]);
        } finally {
          client.release();
        }
      },
      { concurrency },
    );
    const report = mergeReports(reports);
    console.log(
      JSON.stringify(
        { mode: WRITE ? 'applied' : 'dry-run', reviewerActorId: reviewer.actorId, ...report },
        null,
        2,
      ),
    );
    if (!WRITE)
      console.log(
        '\nDRY_RUN (default): nothing written. Set DRY_RUN=0 CLAIM_REVIEW_APPLY=1 to write.',
      );
  } finally {
    await pool.end();
  }
}

// Only run when invoked directly; the test imports this module for its pure functions.
const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

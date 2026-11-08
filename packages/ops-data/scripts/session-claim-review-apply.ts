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
 * All writes run in one transaction as service_role and roll back unless the publisher's own
 * gate SQL accepts every written claim version.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/session-claim-review-apply.ts \
 *     --packets-file=<dir>/packets.jsonl --verdicts-file=<dir>/verdicts.jsonl
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import { runClaimReview, type Verdict } from './lib/claim-review-ledger.ts';

const WRITE = process.env.DRY_RUN === '0' && process.env.CLAIM_REVIEW_APPLY === '1';

function flag(name: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= is required`);
  return hit.slice(name.length + 3);
}

const jsonl = (path: string): Record<string, unknown>[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);

async function main(): Promise<void> {
  const entityIds = [
    ...new Set(jsonl(flag('packets-file')).map((packet) => String(packet.entityId))),
  ];
  const verdicts = jsonl(flag('verdicts-file')) as unknown as Verdict[];
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
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    await client.query(WRITE ? 'BEGIN' : 'BEGIN READ ONLY');
    if (WRITE) await client.query('SET LOCAL ROLE service_role');
    const report = await runClaimReview(client, { entityIds, verdicts, reviewer, write: WRITE });
    await client.query(WRITE ? 'COMMIT' : 'ROLLBACK');
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
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

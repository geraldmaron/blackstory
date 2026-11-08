/**
 * Export independent claim-review packets for landscape records (no writes, no fetches).
 *
 * One packet per publishable claim whose cited source has retained capture text. A packet holds
 * the record name, the claim and that text only; see lib/claim-review-ledger.ts for why. Claims
 * without retained capture text or an attributable producer are listed in `<out>.blocked.json`.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-claim-review-prepare.ts --entity-ids=id1,id2 --out=<dir>/packets.jsonl
 *
 * Review with session-claim-review-codex.ts (Sol via Codex, a different vendor from the Claude
 * producers), which writes one verdict per line to verdicts.jsonl:
 *   { packetId, packetHash, reviewerActorId, decision: "approve"|"reject", fitness, quotes: [{ exact, locator }],
 *     fitnessReason, supportReason }
 * Then validate and apply with session-claim-review-apply.ts.
 */
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import { loadReviewClaims } from './lib/claim-review-ledger.ts';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

async function main(): Promise<void> {
  const entityIds = flag('entity-ids', '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const out = flag('out', '');
  if (entityIds.length === 0 || !out)
    throw new Error('--entity-ids=id1,id2 and --out=<packets.jsonl> are required');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    await client.query('BEGIN READ ONLY');
    const { prepared, blocked, missingEntityIds } = await loadReviewClaims(client, entityIds);
    await client.query('ROLLBACK');
    writeFileSync(
      out,
      prepared.map((claim) => JSON.stringify(claim.packet)).join('\n') +
        (prepared.length ? '\n' : ''),
    );
    const blockedOut = `${out.replace(/\.jsonl$/u, '')}.blocked.json`;
    writeFileSync(blockedOut, `${JSON.stringify({ missingEntityIds, blocked }, null, 2)}\n`);
    console.log(
      `Entities: ${entityIds.length} (${missingEntityIds.length} not in research.landscape_candidates)`,
    );
    console.log(`Packets ready for review: ${prepared.length} -> ${out}`);
    console.log(`Claims blocked: ${blocked.length} -> ${blockedOut}`);
    const reasons = new Map<string, number>();
    for (const claim of blocked) reasons.set(claim.reason, (reasons.get(claim.reason) ?? 0) + 1);
    for (const [reason, count] of reasons) console.log(`  ${reason}: ${count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

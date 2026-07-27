/**
 * One-shot backfill: repair placeholder content_hashes on the CPS historical
 * income/poverty observations.
 *
 * ingest-phase2-census-historical-income.ts once computed content_hash as
 * base64(JSON).slice(0,12), which is not a hash and — because the 12-char slice
 * lands inside the shared JSON prefix — was byte-identical ('eyJtZXRyaWNJ')
 * across all 222 rows. This walks every observation whose content_hash is not a
 * 64-char lowercase hex sha256 and rewrites it with the same formula the fixed
 * ingest now uses: sha256hex(JSON.stringify({metricId, referencePeriod, estimate})).
 *
 * Safe by default (dry run). Pass --commit to write. Usage:
 *   source apps/web/.env.local
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-census-income-hashes.ts [--commit]
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

/** Must stay byte-identical to observationContentHash in the ingest script. */
function observationContentHash(
  metricId: string,
  referencePeriod: string,
  estimate: number,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ metricId, referencePeriod, estimate }))
    .digest('hex');
}

type ObsRow = {
  readonly id: string;
  readonly metric_id: string;
  readonly reference_period: string;
  readonly estimate: string | number;
  readonly content_hash: string;
};

async function main(): Promise<void> {
  const commit = process.argv.includes('--commit');
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<ObsRow>(
      `SELECT id, metric_id, reference_period, estimate, content_hash
       FROM bb_reference.statistical_observations
       WHERE content_hash !~ '^[0-9a-f]{64}$'
       ORDER BY id`,
    );

    const updates = rows.map((row) => ({
      id: row.id,
      from: row.content_hash,
      to: observationContentHash(row.metric_id, row.reference_period, Number(row.estimate)),
    }));

    let applied = 0;
    if (commit) {
      for (const u of updates) {
        await client.query(
          `UPDATE bb_reference.statistical_observations SET content_hash = $2 WHERE id = $1`,
          [u.id, u.to],
        );
        applied += 1;
      }
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    console.log(
      JSON.stringify(
        {
          command: 'backfill-census-income-hashes',
          committed: commit,
          candidates: updates.length,
          applied,
          sample: updates.slice(0, 5),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();

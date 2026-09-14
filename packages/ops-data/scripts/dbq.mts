/**
 * Ad-hoc read-only SQL against the live database, for an operator or agent session.
 *
 * There is no `psql` on the developer machine this repo is worked from, and every other script
 * here opens a pool to run one purpose-built query. Answering "how many rows actually look like
 * that?" — the question that settles most backlog arguments in this repo — therefore meant
 * writing a throwaway script each time, and several got committed by accident.
 *
 * Usage (from the repo root; the env file is what supplies DATABASE_URL):
 *   cd apps/web && set -a && . ./.env.local && set +a && \
 *     node --conditions development --import tsx ../../packages/ops-data/scripts/dbq.mts \
 *     "SELECT count(*) FROM bb_public.release_entities"
 *
 * `--conditions development` is not optional: without it the workspace packages this script's
 * sibling imports resolve from do not resolve at all.
 *
 * READ-ONLY BY CONVENTION, NOT BY ENFORCEMENT. It runs whatever it is handed under whatever role
 * DATABASE_URL carries, which on this project is a privileged one. It exists for SELECTs. A write
 * belongs in a named script with a dry-run mode and a report, where the next person can find it.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const sql = process.argv.slice(2).join(' ');
if (!sql.trim()) {
  console.error('usage: dbq.mts "<sql>"');
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
  process.exit(2);
}

const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
try {
  // A multi-statement string comes back as an ARRAY of results, one per statement, and most of
  // them carry no rows. Printing `result.rows` off that array prints `undefined` and reads like a
  // failure when the statements in fact ran — which is how a rolled-back migration trial looked
  // like a silent error once.
  const result = await pool.query(sql);
  const sets = Array.isArray(result) ? result : [result];
  const withRows = sets.filter((r) => (r.rows?.length ?? 0) > 0);
  console.log(
    JSON.stringify(withRows.length === 1 ? withRows[0].rows : withRows.map((r) => r.rows), null, 1),
  );
} finally {
  await pool.end();
}

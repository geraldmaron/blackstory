#!/usr/bin/env node
/**
 * Reads a single row from bb_ops.kill_switches and prints "engaged" or "disengaged" to stdout.
 * Postgres-native replacement for the Firestore `killSwitches/{id}` read the old Firebase
 * Functions scheduler used (functions/src/kill-switch-env.ts, ADR-018). Fails closed
 * (prints "engaged") on any error or missing row, matching the Firestore fail-closed behavior.
 *
 * Usage: node scripts/check-kill-switch.mjs <kill-switch-id>
 * Requires DATABASE_URL (or APP_DATABASE_URL) in the environment.
 */
import pg from 'pg';

const killSwitchId = process.argv[2] ?? 'research-campaigns';
const connectionString = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();

if (!connectionString) {
  console.error('check-kill-switch: DATABASE_URL/APP_DATABASE_URL not set; failing closed');
  console.log('engaged');
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

try {
  const result = await pool.query(
    'SELECT enabled FROM bb_ops.kill_switches WHERE id = $1 LIMIT 1',
    [killSwitchId],
  );
  if (result.rows.length === 0) {
    console.error(`check-kill-switch: no row for id=${killSwitchId}; failing closed`);
    console.log('engaged');
  } else {
    console.log(result.rows[0].enabled === true ? 'engaged' : 'disengaged');
  }
} catch (error) {
  console.error('check-kill-switch: query failed; failing closed', error);
  console.log('engaged');
} finally {
  await pool.end();
}

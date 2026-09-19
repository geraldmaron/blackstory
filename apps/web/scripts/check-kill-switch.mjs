#!/usr/bin/env node
/** Reads the configured Postgres kill switch and fails closed when the control plane is unavailable. */
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
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

try {
  const result = await pool.query('SELECT enabled FROM ops.kill_switches WHERE id = $1 LIMIT 1', [
    killSwitchId,
  ]);
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

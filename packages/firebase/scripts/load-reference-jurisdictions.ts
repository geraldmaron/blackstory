/**
 * Upsert US state (+ DC) and nation jurisdiction rows into bb_reference.jurisdictions.
 * County rows: packages/firebase/scripts/load-reference-counties.ts (Census Gazetteer).
 *
 * Usage:
 *   DRY_RUN=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/load-reference-jurisdictions.ts
 *   DRY_RUN=0 LOAD_JURISDICTIONS_APPLY=1 DATABASE_URL=… node --conditions development --import tsx \
 *     packages/firebase/scripts/load-reference-jurisdictions.ts
 */
import { US_STATES } from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.js';

type JurisdictionSeed = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly stateFips: string | null;
  readonly countyFips: string | null;
  readonly parentId: string | null;
};

function buildStateSeeds(): readonly JurisdictionSeed[] {
  const nation: JurisdictionSeed = {
    id: 'nation:US',
    kind: 'nation',
    name: 'United States',
    stateFips: null,
    countyFips: null,
    parentId: null,
  };
  const states: JurisdictionSeed[] = US_STATES.map((state) => ({
    id: `state:${state.fips}`,
    kind: 'state',
    name: state.name,
    stateFips: state.fips,
    countyFips: null,
    parentId: 'nation:US',
  }));
  return [nation, ...states];
}

async function main(): Promise<void> {
  const seeds = buildStateSeeds();
  const apply = process.env.LOAD_JURISDICTIONS_APPLY === '1' && process.env.DRY_RUN !== '1';
  console.log(
    JSON.stringify(
      { ok: true, dryRun: !apply, jurisdictionCount: seeds.length, kinds: ['nation', 'state'] },
      null,
      2,
    ),
  );
  if (!apply) {
    console.log('Dry-run only. Set LOAD_JURISDICTIONS_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.');
    return;
  }
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL required for apply mode');

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const j of seeds) {
      await client.query(
        `INSERT INTO bb_reference.jurisdictions
          (id, kind, name, state_fips, county_fips, parent_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           state_fips = EXCLUDED.state_fips,
           parent_id = EXCLUDED.parent_id,
           updated_at = now()`,
        [
          j.id,
          j.kind,
          j.name,
          j.stateFips,
          j.countyFips,
          j.parentId,
          JSON.stringify({ seededBy: 'load-reference-jurisdictions' }),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(`Upserted ${seeds.length} jurisdictions.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

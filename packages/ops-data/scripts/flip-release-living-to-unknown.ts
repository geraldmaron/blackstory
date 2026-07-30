/**
 * Flip remaining released person projection status 'living' → 'unknown'.
 * Death-evidence rows should already be 'deceased' (hotfix-release-deceased-lexicon).
 * Does not touch treatAsLiving / privacy gates.
 *
 *   DRY_RUN=0 FLIP_LIVING_TO_UNKNOWN_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/flip-release-living-to-unknown.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FLIP_LIVING_TO_UNKNOWN_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    const before = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM bb_public.release_entities
       WHERE projection->>'kind' = 'person' AND projection->>'status' = 'living'`,
    );
    console.log(`living persons before: ${before.rows[0]?.n ?? 0}`);
    if (DRY_RUN || !APPLY) {
      console.log('Dry run only. Set DRY_RUN=0 FLIP_LIVING_TO_UNKNOWN_APPLY=1 to apply.');
      return;
    }
    await client.query('BEGIN');
    const ent = await client.query(
      `UPDATE bb_public.release_entities
       SET projection = jsonb_set(projection, '{status}', '"unknown"'::jsonb, true)
       WHERE projection->>'kind' = 'person'
         AND projection->>'status' = 'living'`,
    );
    const search = await client.query(
      `UPDATE bb_public.search_index si
       SET status = 'unknown'
       FROM bb_public.release_entities re
       WHERE si.release_id = re.release_id
         AND si.entity_id = re.entity_id
         AND re.projection->>'kind' = 'person'
         AND si.status = 'living'`,
    );
    await client.query('COMMIT');
    console.log(`release_entities updated: ${ent.rowCount}`);
    console.log(`search_index updated: ${search.rowCount}`);
    const after = await client.query<{ status: string; n: number }>(
      `SELECT projection->>'status' AS status, count(*)::int AS n
       FROM bb_public.release_entities
       WHERE projection->>'kind' = 'person'
       GROUP BY 1 ORDER BY n DESC`,
    );
    console.log(after.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Backfill bb_public.release_entities rows whose empty `related` column was stored as `{}`
 * instead of `[]`, which breaks consumers using jsonb_array_length or .map.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-release-related-empty-array.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_RELEASE_RELATED_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-release-related-empty-array.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_RELEASE_RELATED_APPLY === '1';

const COUNT_SQL = `
SELECT COUNT(*)::text AS n
FROM bb_public.release_entities
WHERE jsonb_typeof(related) = 'object' AND related = '{}'::jsonb
`;

const UPDATE_SQL = `
UPDATE bb_public.release_entities re
SET
  related = '[]'::jsonb,
  projection = CASE
    WHEN jsonb_typeof(re.projection->'related') = 'object'
      AND re.projection->'related' = '{}'::jsonb
    THEN jsonb_set(re.projection, '{related}', '[]'::jsonb, true)
    ELSE re.projection
  END
WHERE jsonb_typeof(re.related) = 'object' AND re.related = '{}'::jsonb
`;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }

  const conn = normalizePgConnectionString(databaseUrl);
  const client = new pg.Client({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  await client.connect();

  try {
    const count = Number((await client.query<{ n: string }>(COUNT_SQL)).rows[0]?.n ?? 0);
    console.log('=== Backfill release_entities.related {} -> [] ===');
    console.log(`Rows to update: ${count}`);

    if (DRY_RUN || !APPLY) {
      console.log('DRY_RUN=1 (default): no writes. Set DRY_RUN=0 BACKFILL_RELEASE_RELATED_APPLY=1 to apply.');
      return;
    }

    const result = await client.query(UPDATE_SQL);
    console.log(`Updated ${result.rowCount ?? 0} rows.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

/**
 * WS0 hotfix: flip release_entities (+ search_index) person rows whose summary
 * matches the extended deceased lexicon but still project status='living'.
 *
 * Does NOT write bb_canonical.living_status from regex (that is WS3). Display
 * and release projections only — McGhie-class falsehoods.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/hotfix-release-deceased-lexicon.ts
 *
 * Apply:
 *   DRY_RUN=0 HOTFIX_RELEASE_DECEASED_LEXICON_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/hotfix-release-deceased-lexicon.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.HOTFIX_RELEASE_DECEASED_LEXICON_APPLY === '1';

/** Mirrors packages/domain derive-catalog-status deceased + lynching verb forms + life range. */
const MATCH_SQL = `
WITH living_persons AS (
  SELECT
    re.release_id,
    re.entity_id,
    re.projection,
    coalesce(re.projection->>'summary','') || ' ' || coalesce(re.projection->>'historicalContext','') AS text
  FROM bb_public.release_entities re
  WHERE re.projection->>'kind' = 'person'
    AND re.projection->>'status' = 'living'
)
SELECT release_id, entity_id, left(text, 160) AS sample
FROM living_persons
WHERE text ~* '\\m(died|death|deceased|passed away|killed|assassinated|hanged|executed|murdered|martyred|slain|posthumous(ly)?|buried at|laid to rest)\\M'
   OR text ~* '\\m(was[[:space:]]+lynched|lynched[[:space:]]+(on|in|by)|lynching[[:space:]]+of)\\M'
   OR text ~ '\\((1[6-9][0-9]{2})[[:space:]]*[–—-][[:space:]]*(1[6-9][0-9]{2}|20[0-2][0-9])\\)'
ORDER BY entity_id
`;

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const { rows } = await client.query<{
      release_id: string;
      entity_id: string;
      sample: string;
    }>(MATCH_SQL);

    console.log('=== Hotfix release deceased lexicon ===');
    console.log(`Matched living persons with death evidence: ${rows.length}`);
    for (const row of rows.slice(0, 15)) {
      console.log(`  ${row.entity_id}: ${row.sample.replace(/\s+/g, ' ').trim()}`);
    }
    if (rows.length > 15) console.log(`  ...and ${rows.length - 15} more`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only. Set DRY_RUN=0 HOTFIX_RELEASE_DECEASED_LEXICON_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      let entitiesUpdated = 0;
      let searchUpdated = 0;
      for (const row of rows) {
        const ent = await client.query(
          `UPDATE bb_public.release_entities
           SET projection = jsonb_set(projection, '{status}', '"deceased"'::jsonb, true)
           WHERE release_id = $1 AND entity_id = $2
             AND projection->>'status' = 'living'`,
          [row.release_id, row.entity_id],
        );
        entitiesUpdated += ent.rowCount ?? 0;

        const search = await client.query(
          `UPDATE bb_public.search_index
           SET status = 'deceased'
           WHERE release_id = $1 AND entity_id = $2
             AND status IS DISTINCT FROM 'deceased'`,
          [row.release_id, row.entity_id],
        );
        searchUpdated += search.rowCount ?? 0;
        console.log(`  fixed ${row.entity_id}`);
      }
      await client.query('COMMIT');
      console.log(`\nApplied: release_entities=${entitiesUpdated}, search_index=${searchUpdated}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const verify = await client.query<{ count: string }>(
      `WITH living_persons AS (
         SELECT coalesce(projection->>'summary','') || ' ' || coalesce(projection->>'historicalContext','') AS text
         FROM bb_public.release_entities
         WHERE projection->>'kind' = 'person'
           AND projection->>'status' = 'living'
       )
       SELECT count(*)::text AS count
       FROM living_persons
       WHERE text ~* '\\m(died|death|deceased|passed away|killed|assassinated|hanged|executed|murdered|martyred|slain|posthumous(ly)?|buried at|laid to rest)\\M'
          OR text ~* '\\m(was[[:space:]]+lynched|lynched[[:space:]]+(on|in|by)|lynching[[:space:]]+of)\\M'
          OR text ~ '\\((1[6-9][0-9]{2})[[:space:]]*[–—-][[:space:]]*(1[6-9][0-9]{2}|20[0-2][0-9])\\)'`,
    );
    console.log(`Verify remaining lexicon-living mismatches: ${verify.rows[0]?.count ?? '?'}`);

    const mcg = await client.query<{ status: string }>(
      `SELECT projection->>'status' AS status
       FROM bb_public.release_entities
       WHERE entity_id = 'lynching_isaac_mcghie_duluth_minnesota'
       LIMIT 1`,
    );
    console.log(`McGhie release status: ${mcg.rows[0]?.status ?? 'missing'}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Upserts Lives Across the Decades region jurisdictions (kind `region`) from the shared registry
 * in @repo/domain so law_applicability and statistical_observations rows can reference them.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   # Dry-run (default)
 *   node --conditions development --import tsx packages/ops-data/scripts/lives-upsert-regions.ts
 *   # Apply
 *   DRY_RUN=0 LIVES_UPSERT_REGIONS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/lives-upsert-regions.ts
 */
import pg from 'pg';
import { LIVES_REGIONS } from '@repo/domain/statistics';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.LIVES_UPSERT_REGIONS_APPLY === '1';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    const parents = await pool.query<{ id: string }>(
      'SELECT id FROM bb_reference.jurisdictions WHERE id = ANY($1::text[])',
      [LIVES_REGIONS.map((region) => region.parentId)],
    );
    const existingParents = new Set(parents.rows.map((row) => row.id));
    for (const region of LIVES_REGIONS) {
      if (!existingParents.has(region.parentId)) {
        throw new Error(`${region.id}: parent ${region.parentId} does not exist`);
      }
    }
    const report = LIVES_REGIONS.map((region) => ({
      id: region.id,
      name: region.name,
      parentId: region.parentId,
      coreCountyFips: region.coreCountyFips,
    }));
    console.log(JSON.stringify({ apply, regions: report }, null, 2));
    if (!apply) {
      console.log('Dry run. Set DRY_RUN=0 LIVES_UPSERT_REGIONS_APPLY=1 to write.');
      return;
    }
    for (const region of LIVES_REGIONS) {
      await pool.query(
        `INSERT INTO bb_reference.jurisdictions (id, kind, name, state_fips, parent_id, metadata)
         VALUES ($1, 'region', $2, $3, $4, $5::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           kind = EXCLUDED.kind,
           name = EXCLUDED.name,
           state_fips = EXCLUDED.state_fips,
           parent_id = EXCLUDED.parent_id,
           metadata = bb_reference.jurisdictions.metadata || EXCLUDED.metadata,
           updated_at = now()`,
        [
          region.id,
          region.name,
          region.stateFips,
          region.parentId,
          JSON.stringify({
            aliases: region.aliases,
            coreCountyFips: region.coreCountyFips,
            slug: region.slug,
            methodology: 'docs/methodology/lives-across-decades.md',
          }),
        ],
      );
    }
    console.log(`Upserted ${LIVES_REGIONS.length} region jurisdiction(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

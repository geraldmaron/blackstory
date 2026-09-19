/**
 * Upserts the six Lives Across the Decades regions (kind `region`, parent `nation:US`) from the shared
 * registry in @repo/domain, and removes region rows the registry no longer lists when nothing
 * references them. The national baseline is the existing `nation:US` row.
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
import {
  LIVES_NATIONAL,
  LIVES_REGIONS,
  livesStateJurisdictionId,
} from '@repo/domain/statistics/lives';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.LIVES_UPSERT_REGIONS_APPLY === '1';

/** Tables whose rows point at a jurisdiction; a stale region is removed only when all are empty. */
const REFERENCING = [
  ['reference.jurisdictions', 'parent_id'],
  ['reference.statistical_observations', 'jurisdiction_id'],
  ['reference.law_applicability', 'jurisdiction_id'],
  ['reference.region_decade_definitions', 'region_id'],
  ['reference.entity_context_bindings', 'jurisdiction_id'],
  ['reference.derived_measurements', 'jurisdiction_id'],
] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    const stateIds = [...new Set(LIVES_REGIONS.flatMap((r) => r.memberStateFips))].map(
      livesStateJurisdictionId,
    );
    const known = await pool.query<{ id: string }>(
      'SELECT id FROM reference.jurisdictions WHERE id = ANY($1::text[])',
      [[LIVES_NATIONAL.id, ...stateIds]],
    );
    const existing = new Set(known.rows.map((row) => row.id));
    const missing = [LIVES_NATIONAL.id, ...stateIds].filter((id) => !existing.has(id));
    if (missing.length > 0) throw new Error(`missing jurisdictions: ${missing.join(', ')}`);

    const regionIds = new Set(LIVES_REGIONS.map((region) => region.id));
    const current = await pool.query<{ id: string }>(
      "SELECT id FROM reference.jurisdictions WHERE kind = 'region' ORDER BY id",
    );
    const stale: { id: string; references: number }[] = [];
    for (const { id } of current.rows.filter((row) => !regionIds.has(row.id))) {
      let references = 0;
      for (const [table, column] of REFERENCING) {
        const result = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
          [id],
        );
        references += result.rows[0]?.n ?? 0;
      }
      stale.push({ id, references });
    }

    console.log(
      JSON.stringify(
        {
          apply,
          regions: LIVES_REGIONS.map((r) => ({
            id: r.id,
            name: r.name,
            states: r.memberStateFips.length,
          })),
          stale,
        },
        null,
        2,
      ),
    );
    const blocked = stale.filter((row) => row.references > 0);
    if (blocked.length > 0) {
      throw new Error(`stale regions still referenced: ${blocked.map((row) => row.id).join(', ')}`);
    }
    if (!apply) {
      console.log('Dry run. Set DRY_RUN=0 LIVES_UPSERT_REGIONS_APPLY=1 to write.');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const region of LIVES_REGIONS) {
        await client.query(
          `INSERT INTO reference.jurisdictions (id, kind, name, state_fips, parent_id, metadata)
           VALUES ($1, 'region', $2, NULL, $3, $4::jsonb)
           ON CONFLICT (id) DO UPDATE SET
             kind = EXCLUDED.kind,
             name = EXCLUDED.name,
             state_fips = NULL,
             parent_id = EXCLUDED.parent_id,
             metadata = EXCLUDED.metadata,
             updated_at = now()`,
          [
            region.id,
            region.name,
            LIVES_NATIONAL.id,
            JSON.stringify({
              slug: region.slug,
              summary: region.summary,
              memberStateFips: region.memberStateFips,
              methodology: 'docs/methodology/lives-across-decades.md',
            }),
          ],
        );
      }
      for (const row of stale) {
        await client.query(
          "DELETE FROM reference.jurisdictions WHERE id = $1 AND kind = 'region'",
          [row.id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(
      `Upserted ${LIVES_REGIONS.length} region(s); removed ${stale.length} stale region(s).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

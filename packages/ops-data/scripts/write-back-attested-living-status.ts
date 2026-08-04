/**
 * Write back operator-attested livingStatus=deceased from landscape personReview
 * markers onto bb_canonical.entities.living_status.
 *
 * Scope: only rows where payload->personReview->>'livingStatus'='deceased'
 * (exactly the operator-attested set — not regex bulk backfill).
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/write-back-attested-living-status.ts
 *
 * Apply writes:
 *   DRY_RUN=0 WRITE_BACK_ATTESTED_LIVING_STATUS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/write-back-attested-living-status.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.WRITE_BACK_ATTESTED_LIVING_STATUS_APPLY === '1';

type AttestedRow = {
  readonly candidate_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly living_status: string | null;
  readonly has_canonical: boolean;
};

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
    const { rows } = await client.query<AttestedRow>(
      `SELECT
         coalesce(nullif(lc.source_item_id, ''), lc.payload->>'entityId', lc.id) AS candidate_id,
         lc.display_name,
         lc.kind,
         e.living_status,
         (e.id IS NOT NULL) AS has_canonical
       FROM bb_research.landscape_candidates lc
       LEFT JOIN bb_canonical.entities e
         ON e.id = coalesce(nullif(lc.source_item_id, ''), lc.payload->>'entityId', lc.id)
       WHERE lc.payload->'personReview'->>'livingStatus' = 'deceased'
         AND (
           (lc.payload->'personReview'->>'approved')::boolean IS TRUE
           OR lc.lane <> 'living-status-review'
         )
       ORDER BY 1`,
    );

    console.log('=== Write-back attested living_status=deceased ===');
    console.log(`Attested landscape rows: ${rows.length}`);

    const missingCanonical = rows.filter((r) => !r.has_canonical);
    const alreadyDeceased = rows.filter((r) => r.has_canonical && r.living_status === 'deceased');
    const toUpdate = rows.filter((r) => r.has_canonical && r.living_status !== 'deceased');

    console.log(`  already deceased: ${alreadyDeceased.length}`);
    console.log(`  needs update:     ${toUpdate.length}`);
    console.log(`  missing canonical:${missingCanonical.length}`);

    for (const row of toUpdate) {
      console.log(
        `  UPDATE ${row.candidate_id} (${row.display_name}): ${row.living_status ?? 'null'} -> deceased`,
      );
    }
    for (const row of missingCanonical) {
      console.log(`  SKIP missing canonical: ${row.candidate_id} (${row.display_name})`);
    }
    for (const row of alreadyDeceased.slice(0, 3)) {
      console.log(`  ok already deceased: ${row.candidate_id}`);
    }
    if (alreadyDeceased.length > 3) {
      console.log(`  ...and ${alreadyDeceased.length - 3} already deceased`);
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no writes. Set DRY_RUN=0 WRITE_BACK_ATTESTED_LIVING_STATUS_APPLY=1 to apply.',
      );
      console.log(
        `\nAfter apply, republish with:\n  node --conditions development --import tsx \\\n    packages/ops-data/scripts/publish-release-entities-incremental.ts \\\n    --ids=${toUpdate
          .map((r) => r.candidate_id)
          .concat(alreadyDeceased.map((r) => r.candidate_id))
          .join(',')}`,
      );
      return;
    }

    let updated = 0;
    await client.query('BEGIN');
    try {
      for (const row of toUpdate) {
        const result = await client.query(
          `UPDATE bb_canonical.entities
           SET living_status = 'deceased', updated_at = now()
           WHERE id = $1 AND living_status IS DISTINCT FROM 'deceased'`,
          [row.candidate_id],
        );
        updated += result.rowCount ?? 0;
        console.log(`  wrote ${row.candidate_id}`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const verify = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM bb_research.landscape_candidates lc
       JOIN bb_canonical.entities e
         ON e.id = coalesce(nullif(lc.source_item_id, ''), lc.payload->>'entityId', lc.id)
       WHERE lc.payload->'personReview'->>'livingStatus' = 'deceased'
         AND (lc.payload->'personReview'->>'approved')::boolean IS TRUE
         AND e.living_status = 'deceased'`,
    );
    console.log(`\nApplied: updated ${updated} rows.`);
    console.log(`Verified attested+canonical deceased: ${verify.rows[0]?.count ?? '0'}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

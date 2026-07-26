/**
 * Proof spine: Black homeownership rate, Cook County IL — splices the NHGIS
 * decennial county tenure series (1990-2010) onto the ACS 5-year county series
 * (2020-2024 vintage, the only ACS vintage ingested so far). Demonstrates the
 * spine_series / spine_segments / spine_observations_v mechanism ahead of the
 * national Phase 1 backfills (repo-zxjz.2-.10).
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/seed-proof-spine-cook-homeownership.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 SEED_PROOF_SPINE_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/seed-proof-spine-cook-homeownership.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SPINE_ID = 'spine-homeownership-rate-black-cook-county-il';
const NHGIS_METRIC_ID = 'nhgis-homeownership-rate-black-county';
const ACS_METRIC_ID = 'acs-homeownership-rate-black-county';

async function main(): Promise<void> {
  const apply = process.env.SEED_PROOF_SPINE_APPLY === '1' && process.env.DRY_RUN !== '1';
  const databaseUrl = process.env.DATABASE_URL;

  if (!apply) {
    console.log('[dry-run] Would upsert spine_series row:', SPINE_ID);
    console.log('[dry-run] Would upsert 2 spine_segments rows:', NHGIS_METRIC_ID, ACS_METRIC_ID);
    console.log('[dry-run] Set SEED_PROOF_SPINE_APPLY=1 DRY_RUN=0 DATABASE_URL=... to apply.');
    return;
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when SEED_PROOF_SPINE_APPLY=1');
  }

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });

  try {
    const existing = await pool.query<{ metric_id: string }>(
      `SELECT metric_id FROM bb_reference.statistical_series WHERE metric_id = ANY($1::text[])`,
      [[NHGIS_METRIC_ID, ACS_METRIC_ID]],
    );
    const found = new Set(existing.rows.map((r) => r.metric_id));
    if (!found.has(NHGIS_METRIC_ID) || !found.has(ACS_METRIC_ID)) {
      throw new Error(
        `Missing source metric(s) in bb_reference.statistical_series: ` +
          [NHGIS_METRIC_ID, ACS_METRIC_ID].filter((id) => !found.has(id)).join(', ') +
          ' — run ingest-phase1-nhgis.ts and ingest-phase1-acs.ts first.',
      );
    }

    const overlap = await pool.query<{ reference_period: string; source: string; estimate: number }>(
      `SELECT reference_period, source, estimate
       FROM bb_reference.statistical_observations
       WHERE metric_id = ANY($1::text[])
       ORDER BY reference_period`,
      [[NHGIS_METRIC_ID, ACS_METRIC_ID]],
    );

    await pool.query(
      `INSERT INTO bb_reference.spine_series
        (spine_id, title, outcome, race_ethnicity_slice, geography_type, unit, definition, comparability_note, theme, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (spine_id) DO UPDATE SET
         title = EXCLUDED.title,
         outcome = EXCLUDED.outcome,
         comparability_note = EXCLUDED.comparability_note,
         updated_at = now()`,
      [
        SPINE_ID,
        'Black homeownership rate, Cook County IL, 1990-2024',
        'homeownership',
        'black',
        'county',
        'percentage',
        'Share of Black-householder occupied housing units that are owner-occupied, Cook County IL.',
        'Proof spine only (county-level). NHGIS decennial tenure-by-race (1990-2010) is exact-count based; ACS 2020-2024 5-year estimate carries sampling margin of error and a different reference-period convention (5-year pooled vs point-in-time decennial). No overlapping year exists yet between the two segments (gap 2011-2019) — seam_check is empty pending an overlapping vintage.',
        'housing',
        'draft',
      ],
    );

    await pool.query(
      `INSERT INTO bb_reference.spine_segments
        (id, spine_id, metric_id, period_start, period_end, priority, splice_note, seam_check)
       VALUES
        ($1, $2, $3, '1990', '2010', 0, $4, '{}'::jsonb),
        ($5, $2, $6, '2011', '2024', 1, $7, '{}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         splice_note = EXCLUDED.splice_note,
         updated_at = now()`,
      [
        `seg:${SPINE_ID}:1990-2010`,
        SPINE_ID,
        NHGIS_METRIC_ID,
        'Decennial county tenure-by-race tabulation (STF1A/SF1), exact count, no sampling error.',
        `seg:${SPINE_ID}:2011-2024`,
        ACS_METRIC_ID,
        'ACS 5-year estimate (2020-2024 vintage), subject to margin of error; pooled 5-year universe rather than a single point in time.',
      ],
    );

    console.log(`Upserted spine ${SPINE_ID} with 2 segments.`);
    console.log(`Source observations found: ${overlap.rows.length}`, overlap.rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

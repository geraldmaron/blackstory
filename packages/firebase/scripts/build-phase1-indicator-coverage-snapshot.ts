/**
 * Build and upsert `phase1IndicatorCoverage` into `bb_public.materialized_snapshots`.
 * Aggregates row counts from `bb_reference.statistical_series` and
 * `statistical_observations` so `/data` can show `sampleObservationCount` via a
 * point-get (same pattern as `nationalPopulationTimeline` / `data-summaries.ts`).
 *
 * Usage (repo root):
 *   # Dry-run (counts only)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-phase1-indicator-coverage-snapshot.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 BUILD_PHASE1_COVERAGE_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/build-phase1-indicator-coverage-snapshot.ts
 */
import { sha256Json, summarizePhase1IndicatorCatalog } from '@repo/domain';
import pg from 'pg';

const SNAPSHOT_NAME = 'phase1IndicatorCoverage';

function normalizePgConnectionString(connectionString: string): {
  readonly connectionString: string;
  readonly ssl?: { readonly rejectUnauthorized: false };
} {
  const isSupabase =
    /supabase\.(co|com)/i.test(connectionString) ||
    process.env.DATABASE_SSL === '1' ||
    process.env.DATABASE_SSL === 'true';
  if (!isSupabase) return { connectionString };
  let normalized = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.set('uselibpqcompat', 'true');
    url.searchParams.set('sslmode', 'require');
    normalized = url.toString();
  } catch {
    normalized = connectionString;
  }
  return {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
  };
}

export type Phase1IndicatorCoverageSnapshot = {
  readonly seriesCount: number;
  readonly sampleObservationCount: number;
  readonly catalogMetricCount: number;
  readonly generatedAt: string;
  readonly contentHash: string;
};

type CountRow = {
  readonly series_count: number;
  readonly observation_count: number;
};

export async function buildPhase1IndicatorCoverageSnapshot(
  pool: pg.Pool,
  now: () => string = () => new Date().toISOString(),
): Promise<Phase1IndicatorCoverageSnapshot> {
  const result = await pool.query<CountRow>(
    `SELECT
       (SELECT count(*)::int FROM bb_reference.statistical_series) AS series_count,
       (SELECT count(*)::int FROM bb_reference.statistical_observations) AS observation_count`,
  );
  const row = result.rows[0];
  const seriesCount = row?.series_count ?? 0;
  const sampleObservationCount = row?.observation_count ?? 0;
  const catalogMetricCount = summarizePhase1IndicatorCatalog().metricCount;
  const payload = { seriesCount, sampleObservationCount, catalogMetricCount };
  const contentHash = sha256Json(payload).digest;
  return { ...payload, generatedAt: now(), contentHash };
}

export async function writePhase1IndicatorCoverageSnapshot(
  pool: pg.Pool,
  snapshot: Phase1IndicatorCoverageSnapshot,
): Promise<'created' | 'updated' | 'unchanged'> {
  const existing = await pool.query<{ payload: Phase1IndicatorCoverageSnapshot }>(
    `SELECT payload FROM bb_public.materialized_snapshots WHERE name = $1 LIMIT 1`,
    [SNAPSHOT_NAME],
  );
  const prior = existing.rows[0]?.payload;
  if (prior?.contentHash === snapshot.contentHash) {
    return 'unchanged';
  }
  await pool.query(
    `INSERT INTO bb_public.materialized_snapshots (name, payload, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (name) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [SNAPSHOT_NAME, JSON.stringify(snapshot)],
  );
  return prior ? 'updated' : 'created';
}

async function main(): Promise<void> {
  const apply =
    process.env.BUILD_PHASE1_COVERAGE_APPLY === '1' && process.env.DRY_RUN !== '1';
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();

  if (apply && !databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  if (!apply) {
    const catalog = summarizePhase1IndicatorCatalog();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          snapshotName: SNAPSHOT_NAME,
          catalogMetricCount: catalog.metricCount,
          note: 'Set BUILD_PHASE1_COVERAGE_APPLY=1 DRY_RUN=0 DATABASE_URL=… to query Postgres and upsert.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const conn = normalizePgConnectionString(databaseUrl!);
  const pool = new pg.Pool(conn);
  try {
    const snapshot = await buildPhase1IndicatorCoverageSnapshot(pool);
    const outcome = await writePhase1IndicatorCoverageSnapshot(pool, snapshot);
    console.log(JSON.stringify({ ok: true, outcome, snapshot }, null, 2));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

/**
 * HMDA county aggregate ingest for Phase 1 denial-rate observations into
 * bb_reference.statistical_observations. Uses FFIEC Data Browser /view/aggregations
 * only — never stores loan-level HMDA rows. Cook County IL (17031) by default.
 *
 * Usage (repo root):
 *   # Dry-run (default) — fixture unless --live
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-hmda-aggregates.ts
 *
 *   # Live FFIEC aggregations API (Cook County 2018–2023)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-hmda-aggregates.ts --live
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_HMDA_AGGREGATES_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-hmda-aggregates.ts --live
 *
 *   # Custom county FIPS (5-digit) and years
 *   PHASE1_HMDA_COUNTY_FIPS=17031 PHASE1_HMDA_YEARS=2022,2023 \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-hmda-aggregates.ts --live
 *
 *   # Offline fixture JSON (skip network)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-hmda-aggregates.ts \
 *     --hmda-fixture-json=packages/domain/src/adapters/hmda/fixtures/cook-county-17031-aggregations-sample.json
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchPhase1HmdaCountyObservations,
  HMDA_AGGREGATE_STRATEGY_NOTE,
  HMDA_DATA_BROWSER_HOMEPAGE_URL,
  listPhase1HmdaIndicators,
  PHASE1_HMDA_DEFAULT_COUNTY_FIPS,
  PHASE1_HMDA_DEFAULT_YEARS,
  type HmdaAggregationsResponse,
  type Phase1HmdaObservationDraft,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildPhase1IndicatorCoverageSnapshot,
  writePhase1IndicatorCoverageSnapshot,
} from './build-phase1-indicator-coverage-snapshot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(
  __dirname,
  '../../domain/src/adapters/hmda/fixtures/cook-county-17031-aggregations-sample.json',
);

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseCountyFips(): string {
  const raw = process.env.PHASE1_HMDA_COUNTY_FIPS?.trim() || PHASE1_HMDA_DEFAULT_COUNTY_FIPS;
  if (!/^\d{5}$/.test(raw)) {
    throw new Error(`PHASE1_HMDA_COUNTY_FIPS must be 5-digit FIPS, got "${raw}"`);
  }
  return raw;
}

function parseYears(): number[] {
  const raw = process.env.PHASE1_HMDA_YEARS?.trim();
  if (!raw) return [...PHASE1_HMDA_DEFAULT_YEARS];
  const years = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));
  for (const year of years) {
    if (!Number.isInteger(year)) {
      throw new Error(`PHASE1_HMDA_YEARS must be comma-separated integers, got "${raw}"`);
    }
  }
  return years;
}

function loadFixturePayloads(
  fixturePath: string,
  years: readonly number[],
): Map<number, HmdaAggregationsResponse> {
  const text = readFileSync(fixturePath, 'utf8');
  const payload = JSON.parse(text) as HmdaAggregationsResponse;
  const byYear = new Map<number, HmdaAggregationsResponse>();

  for (const year of years) {
    const yearStr = String(year);
    const slices = payload.aggregations.filter(
      (row) => row.activity_year === yearStr || payload.parameters?.years === yearStr,
    );
    byYear.set(year, {
      parameters: {
        years: yearStr,
        counties: parseCountyFips(),
        actions_taken: '1,2,3',
        races: 'White,Black or African American',
      },
      aggregations: slices,
      servedFrom: 'fixture',
    });
  }

  return byYear;
}

async function loadExistingJurisdictionIds(databaseUrl: string): Promise<Set<string>> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  try {
    const result = await pool.query<{ id: string }>('SELECT id FROM bb_reference.jurisdictions');
    return new Set(result.rows.map((row) => row.id));
  } finally {
    await pool.end();
  }
}

function filterObservationsWithJurisdictions(
  observations: readonly Phase1HmdaObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly Phase1HmdaObservationDraft[];
  readonly missingJurisdictions: readonly string[];
} {
  const missing = new Set<string>();
  const accepted = observations.filter((obs) => {
    if (jurisdictionIds.has(obs.jurisdictionId)) return true;
    missing.add(obs.jurisdictionId);
    return false;
  });
  return { accepted, missingJurisdictions: [...missing].sort() };
}

async function applyObservations(
  observations: readonly Phase1HmdaObservationDraft[],
  databaseUrl: string,
): Promise<number> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  let written = 0;
  try {
    await client.query('BEGIN');

    for (const series of listPhase1HmdaIndicators()) {
      await client.query(
        `INSERT INTO bb_reference.statistical_series
          (metric_id, metric_definition, universe, unit, source_dataset, source_table,
           source_variable, geography_type, estimate_type, period_type,
           external_data_source_id, theme, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ON CONFLICT (metric_id) DO UPDATE SET
           metric_definition = EXCLUDED.metric_definition,
           universe = EXCLUDED.universe,
           unit = EXCLUDED.unit,
           source_dataset = EXCLUDED.source_dataset,
           source_table = EXCLUDED.source_table,
           source_variable = EXCLUDED.source_variable,
           geography_type = EXCLUDED.geography_type,
           estimate_type = EXCLUDED.estimate_type,
           period_type = EXCLUDED.period_type,
           external_data_source_id = EXCLUDED.external_data_source_id,
           theme = EXCLUDED.theme,
           updated_at = now()`,
        [
          series.metricId,
          series.metricDefinition,
          series.universe,
          series.unit,
          series.sourceDataset,
          series.sourceTable,
          series.sourceVariable,
          series.geographyType,
          series.estimateType,
          series.periodType,
          series.externalDataSourceId,
          series.theme,
          JSON.stringify({
            raceEthnicitySlice: series.raceEthnicitySlice ?? null,
            methodologyNote: HMDA_AGGREGATE_STRATEGY_NOTE,
          }),
        ],
      );
    }

    for (const obs of observations) {
      await client.query(
        `INSERT INTO bb_reference.statistical_observations
          (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
           estimate, margin_of_error, race_ethnicity_slice, status, source, source_url,
           retrieved_at, content_hash, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'observed',$10,$11,$12::timestamptz,$13,$14::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           estimate = EXCLUDED.estimate,
           content_hash = EXCLUDED.content_hash,
           retrieved_at = EXCLUDED.retrieved_at,
           metadata = EXCLUDED.metadata`,
        [
          obs.id,
          obs.metricId,
          obs.jurisdictionId,
          obs.boundaryVersion,
          obs.referencePeriod,
          obs.datasetVintage,
          obs.estimate,
          null,
          obs.raceEthnicitySlice ?? null,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            applicationCount: obs.applicationCount ?? null,
            denialCount: obs.denialCount ?? null,
            methodologyNote: obs.methodologyNote,
          }),
        ],
      );
      written += 1;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  return written;
}

async function main(): Promise<void> {
  const apply =
    process.env.INGEST_PHASE1_HMDA_AGGREGATES_APPLY === '1' && process.env.DRY_RUN !== '1';
  const countyFips = parseCountyFips();
  const years = parseYears();
  const live = hasFlag('live');
  const fixturePath = arg('hmda-fixture-json') ?? (live ? undefined : DEFAULT_FIXTURE);

  const fetchOptions: Parameters<typeof fetchPhase1HmdaCountyObservations>[0] = {
    countyFips,
    years,
  };

  if (fixturePath) {
    if (!existsSync(fixturePath)) {
      throw new Error(`HMDA fixture not found: ${fixturePath}`);
    }
    fetchOptions.aggregationPayloads = loadFixturePayloads(fixturePath, years);
  }

  const fetchResult = await fetchPhase1HmdaCountyObservations(fetchOptions);

  const byMetric = new Map<string, number>();
  for (const obs of fetchResult.observations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    countyFips: fetchResult.countyFips,
    yearsRequested: years,
    yearsFetched: fetchResult.yearsFetched,
    fetchedObservations: fetchResult.observations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejected: fetchResult.rejected,
    sourceUrl: fetchResult.sourceUrl,
    homepageUrl: HMDA_DATA_BROWSER_HOMEPAGE_URL,
    methodologyNote: HMDA_AGGREGATE_STRATEGY_NOTE,
    mode: fixturePath ? 'fixture' : 'live',
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_HMDA_AGGREGATES_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const jurisdictionIds = await loadExistingJurisdictionIds(databaseUrl);
  const { accepted, missingJurisdictions } = filterObservationsWithJurisdictions(
    fetchResult.observations,
    jurisdictionIds,
  );
  if (missingJurisdictions.length > 0) {
    summary.missingJurisdictionCount = missingJurisdictions.length;
    summary.missingJurisdictionSample = missingJurisdictions.slice(0, 10);
  }

  const written = await applyObservations(accepted, databaseUrl);
  summary.appliedObservations = written;
  summary.skippedMissingJurisdiction = fetchResult.observations.length - accepted.length;

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool(conn);
  try {
    const snapshot = await buildPhase1IndicatorCoverageSnapshot(pool);
    const snapshotOutcome = await writePhase1IndicatorCoverageSnapshot(pool, snapshot);
    summary.snapshotOutcome = snapshotOutcome;
    summary.sampleObservationCount = snapshot.sampleObservationCount;
    summary.seriesCount = snapshot.seriesCount;
  } finally {
    await pool.end();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

/**
 * CDC EJI + EPA TRI county environmental ingest for Phase 1 observations into
 * bb_reference.statistical_observations. Fixture-backed by default (Cook 17031 +
 * DuPage 17043 + Lake 17097); set PHASE1_EJI_TRI_ALL_IL_COUNTIES=1 for all 102 IL
 * counties via eji-il-counties-full.csv / tri-il-counties-full.csv; optional --live
 * for source downloads (CDC EJI via Zenodo fallback when state CSV 404s).
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eji-tri.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_EJI_TRI_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eji-tri.ts
 *
 *   # Live source fetch (optional; may fail without network/API access)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eji-tri.ts --live
 *
 *   # Custom fixtures
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eji-tri.ts \
 *     --eji-fixture-csv=packages/firebase/fixtures/reference-indicators/eji-il-counties-sample.csv \
 *     --tri-fixture-csv=packages/firebase/fixtures/reference-indicators/tri-il-counties-sample.csv
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE,
  CDC_EJI_DATA_DOWNLOAD_URL,
  CDC_EJI_IL_FULL_FIXTURE_FILENAME,
  fetchPhase1EjiCountyObservations,
  listPhase1EjiIndicators,
  type Phase1EjiObservationDraft,
} from '../../domain/src/adapters/cdc-eji/index.js';
import {
  EPA_TRI_AGGREGATE_STRATEGY_NOTE,
  EPA_TRI_HOMEPAGE_URL,
  EPA_TRI_IL_FULL_FIXTURE_FILENAME,
  fetchPhase1TriCountyObservations,
  listPhase1TriIndicators,
  type Phase1TriObservationDraft,
} from '../../domain/src/adapters/epa-tri/index.js';
import { listPhase1EjiTriIndicators } from '../../domain/src/statistics/phase1-eji-tri-indicator-catalog.js';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildPhase1IndicatorCoverageSnapshot,
  writePhase1IndicatorCoverageSnapshot,
} from './build-phase1-indicator-coverage-snapshot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_EJI_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/eji-il-counties-sample.csv',
);
const DEFAULT_TRI_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/tri-il-counties-sample.csv',
);
const FULL_EJI_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators',
  CDC_EJI_IL_FULL_FIXTURE_FILENAME,
);
const FULL_TRI_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators',
  EPA_TRI_IL_FULL_FIXTURE_FILENAME,
);

type Phase1EjiTriObservationDraft = Phase1EjiObservationDraft | Phase1TriObservationDraft;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseCountyFips(): string[] | undefined {
  const raw = process.env.PHASE1_EJI_TRI_COUNTY_FIPS?.trim();
  if (!raw) return undefined;
  const counties = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const fips of counties) {
    if (!/^\d{5}$/.test(fips)) {
      throw new Error(`PHASE1_EJI_TRI_COUNTY_FIPS entry must be 5-digit FIPS, got "${fips}"`);
    }
  }
  return counties;
}

function parseTriYears(): number[] | undefined {
  const raw = process.env.PHASE1_EJI_TRI_TRI_YEARS?.trim();
  if (!raw) return undefined;
  const years = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));
  for (const year of years) {
    if (!Number.isInteger(year)) {
      throw new Error(`PHASE1_EJI_TRI_TRI_YEARS must be comma-separated integers, got "${raw}"`);
    }
  }
  return years;
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
  observations: readonly Phase1EjiTriObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly Phase1EjiTriObservationDraft[];
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
  observations: readonly Phase1EjiTriObservationDraft[],
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

    for (const series of listPhase1EjiTriIndicators()) {
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
            methodologyNote:
              series.metricId === 'cdc-eji-environmental-burden-score-county'
                ? CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE
                : EPA_TRI_AGGREGATE_STRATEGY_NOTE,
          }),
        ],
      );
    }

    for (const obs of observations) {
      const metadata =
        'tractCount' in obs
          ? {
              tractCount: obs.tractCount,
              methodologyNote: obs.methodologyNote,
            }
          : {
              facilityCount: obs.facilityCount,
              methodologyNote: obs.methodologyNote,
            };

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
          null,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify(metadata),
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

function allIllinoisCounties(): boolean {
  return process.env.PHASE1_EJI_TRI_ALL_IL_COUNTIES === '1';
}

async function main(): Promise<void> {
  const apply = process.env.INGEST_PHASE1_EJI_TRI_APPLY === '1' && process.env.DRY_RUN !== '1';
  const live = hasFlag('live');
  const expandedIl = allIllinoisCounties();
  const countyFips = expandedIl ? undefined : parseCountyFips();
  const triYears = parseTriYears();
  const ejiFixturePath =
    arg('eji-fixture-csv') ??
    (live ? undefined : expandedIl ? FULL_EJI_FIXTURE : DEFAULT_EJI_FIXTURE);
  const triFixturePath =
    arg('tri-fixture-csv') ??
    (live ? undefined : expandedIl ? FULL_TRI_FIXTURE : DEFAULT_TRI_FIXTURE);

  if (ejiFixturePath && !existsSync(ejiFixturePath)) {
    throw new Error(`EJI fixture not found: ${ejiFixturePath}`);
  }
  if (triFixturePath && !existsSync(triFixturePath)) {
    throw new Error(`TRI fixture not found: ${triFixturePath}`);
  }

  const ejiResult = await fetchPhase1EjiCountyObservations({
    ...(countyFips ? { countyFips } : {}),
    ...(expandedIl ? { allIllinoisCounties: true } : {}),
    ...(ejiFixturePath
      ? { fixtureCsvText: readFileSync(ejiFixturePath, 'utf8'), fixturePath: ejiFixturePath }
      : {}),
    live,
  });

  const triResult = await fetchPhase1TriCountyObservations({
    ...(countyFips ? { countyFips } : {}),
    ...(expandedIl ? { allIllinoisCounties: true } : {}),
    ...(triYears ? { reportingYears: triYears } : {}),
    ...(triFixturePath
      ? { fixtureCsvText: readFileSync(triFixturePath, 'utf8'), fixturePath: triFixturePath }
      : {}),
    live,
  });

  const observations: Phase1EjiTriObservationDraft[] = [
    ...ejiResult.observations,
    ...triResult.observations,
  ];

  const byMetric = new Map<string, number>();
  for (const obs of observations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const cookEji = ejiResult.observations.find((obs) => obs.jurisdictionId === 'county:17031');
  const cookTri2023 = triResult.observations.find(
    (obs) => obs.jurisdictionId === 'county:17031' && obs.referencePeriod === '2023',
  );

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    mode: live ? 'live' : 'fixture',
    expandedIllinois: expandedIl,
    ejiFetchMode: ejiResult.mode,
    triFetchMode: triResult.mode,
    countyCoverageCount: {
      eji: ejiResult.countyCoverageCount,
      tri: triResult.countyCoverageCount,
    },
    countyFips: ejiResult.countyFips,
    ejiReferencePeriod: ejiResult.referencePeriod,
    triReportingYears: triResult.reportingYears,
    fetchedObservations: observations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    ejiRejected: ejiResult.rejected,
    triRejected: triResult.rejected,
    ejiFixturePath: ejiResult.fixturePath ?? ejiFixturePath ?? null,
    triFixturePath: triResult.fixturePath ?? triFixturePath ?? null,
    ejiCachePath: ejiResult.cachePath ?? null,
    triCachePaths: triResult.cachePaths ?? null,
    ejiSourceUrl: CDC_EJI_DATA_DOWNLOAD_URL,
    triSourceUrl: EPA_TRI_HOMEPAGE_URL,
    ejiMethodologyNote: CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE,
    triMethodologyNote: EPA_TRI_AGGREGATE_STRATEGY_NOTE,
    cookCounty: {
      ejiEnvironmentalBurdenScore: cookEji?.estimate ?? null,
      ejiTractCount: cookEji && 'tractCount' in cookEji ? cookEji.tractCount : null,
      triFacilityCount2023: cookTri2023?.estimate ?? null,
      priorPilotEji: 0.74,
      priorPilotTri2023: 12,
    },
    indicatorSeriesRegistered: listPhase1EjiTriIndicators().length,
    ejiIndicators: listPhase1EjiIndicators().map((row) => row.metricId),
    triIndicators: listPhase1TriIndicators().map((row) => row.metricId),
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_EJI_TRI_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const jurisdictionIds = await loadExistingJurisdictionIds(databaseUrl);
  const { accepted, missingJurisdictions } = filterObservationsWithJurisdictions(
    observations,
    jurisdictionIds,
  );
  if (missingJurisdictions.length > 0) {
    summary.missingJurisdictionCount = missingJurisdictions.length;
    summary.missingJurisdictionSample = missingJurisdictions.slice(0, 10);
  }

  const written = await applyObservations(accepted, databaseUrl);
  summary.appliedObservations = written;
  summary.skippedMissingJurisdiction = observations.length - accepted.length;

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

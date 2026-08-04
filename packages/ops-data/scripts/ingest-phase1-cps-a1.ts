/**
 * Census CPS A-1 Historical Reported Voting Rates ingest for Phase 1 observations
 * into bb_reference.statistical_observations. Extends existing turnout metrics
 * (1992-2020) with missing presidential years 1964-1988 and adds new registration
 * metrics for Black and White populations.
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase1-cps-a1.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_CPS_A1_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase1-cps-a1.ts
 *
 *   # Custom fixture CSV
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase1-cps-a1.ts \
 *     --cps-fixture-csv=packages/ops-data/fixtures/reference-indicators/cps-a1-presidential-citizen-turnout-by-race-1964-2020.csv
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildPhase1IndicatorCoverageSnapshot,
  writePhase1IndicatorCoverageSnapshot,
} from './build-phase1-indicator-coverage-snapshot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/cps-a1-presidential-citizen-turnout-by-race-1964-2020.csv',
);

const CPS_A1_URL =
  'https://www2.census.gov/programs-surveys/cps/tables/time-series/voting-historical-time-series/a1.xlsx';
const CPS_A1_RETRIEVED = '2026-07-24T05:02:00.000Z';
const NATION_JURISDICTION = 'nation:US';

interface CpsObservationDraft {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string | null;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

interface CpsSeriesDraft {
  readonly metricId: string;
  readonly metricDefinition: string;
  readonly universe: string;
  readonly unit: string;
  readonly sourceDataset: string;
  readonly sourceTable: string;
  readonly sourceVariable: string;
  readonly geographyType: string;
  readonly estimateType: string;
  readonly periodType: string;
  readonly externalDataSourceId: string;
  readonly theme: string;
  readonly raceEthnicitySlice: string | null;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function parseCsvLine(line: string, headers: string[]): Record<string, string> {
  const values = line.split(',');
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = values[i]?.trim() || '';
  });
  return obj;
}

interface FetchResult {
  observations: CpsObservationDraft[];
  series: CpsSeriesDraft[];
  fixturePath: string;
  sourceUrl: string;
  retrievedAt: string;
  contentHash: string;
  years: number[];
  rejected: string[];
}

function fetchCpsA1Observations(options: {
  fixtureCsvText: string;
  fixturePath: string;
}): FetchResult {
  const { fixtureCsvText, fixturePath } = options;
  const contentHash = hashContent(fixtureCsvText);
  const observations: CpsObservationDraft[] = [];
  const series: CpsSeriesDraft[] = [];
  const years = new Set<number>();
  const rejected: string[] = [];

  const lines = fixtureCsvText.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length === 0) {
    throw new Error('CSV has no data rows');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const expectedHeaders = [
    'year',
    'white_non_hispanic_citizen_pct',
    'black_citizen_pct',
    'asian_citizen_pct',
    'hispanic_citizen_pct',
  ];

  if (!headers.every((h, i) => h === expectedHeaders[i])) {
    throw new Error(
      `CSV headers mismatch. Expected ${expectedHeaders.join(', ')}, got ${headers.join(', ')}`,
    );
  }

  // Define all metric series
  const turnoutSeries: Record<string, CpsSeriesDraft> = {
    'cps-a1-turnout-black-nation': {
      metricId: 'cps-a1-turnout-black-nation',
      metricDefinition:
        'Black citizen voter turnout (presidential elections, reported voting rate)',
      universe:
        'Black citizen voting-age population (Universe varies by year: VAP pre-1990, CVP 1990+)',
      unit: 'percent',
      sourceDataset: 'Census CPS Historical Reported Voting Rates',
      sourceTable: 'Table A-1',
      sourceVariable: 'Black citizen reported voting rate',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'custom-range',
      externalDataSourceId: 'us-census-cps',
      theme: 'voting-rights',
      raceEthnicitySlice: 'black',
    },
    'cps-a1-turnout-white-nation': {
      metricId: 'cps-a1-turnout-white-nation',
      metricDefinition:
        'White non-Hispanic citizen voter turnout (presidential elections, reported voting rate)',
      universe:
        'White non-Hispanic citizen voting-age population (Universe varies by year: VAP pre-1990, CVP 1990+)',
      unit: 'percent',
      sourceDataset: 'Census CPS Historical Reported Voting Rates',
      sourceTable: 'Table A-1',
      sourceVariable: 'White non-Hispanic citizen reported voting rate',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'custom-range',
      externalDataSourceId: 'us-census-cps',
      theme: 'voting-rights',
      raceEthnicitySlice: 'white-non-hispanic',
    },
    'cps-a1-turnout-hispanic-nation': {
      metricId: 'cps-a1-turnout-hispanic-nation',
      metricDefinition:
        'Hispanic citizen voter turnout (presidential elections, reported voting rate)',
      universe:
        'Hispanic citizen voting-age population (Universe varies by year: VAP pre-1990, CVP 1990+)',
      unit: 'percent',
      sourceDataset: 'Census CPS Historical Reported Voting Rates',
      sourceTable: 'Table A-1',
      sourceVariable: 'Hispanic citizen reported voting rate',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'custom-range',
      externalDataSourceId: 'us-census-cps',
      theme: 'voting-rights',
      raceEthnicitySlice: 'hispanic',
    },
    'cps-a1-turnout-asian-nation': {
      metricId: 'cps-a1-turnout-asian-nation',
      metricDefinition:
        'Asian citizen voter turnout (presidential elections, reported voting rate)',
      universe:
        'Asian citizen voting-age population (Universe varies by year: VAP pre-1990, CVP 1990+)',
      unit: 'percent',
      sourceDataset: 'Census CPS Historical Reported Voting Rates',
      sourceTable: 'Table A-1',
      sourceVariable: 'Asian citizen reported voting rate',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'custom-range',
      externalDataSourceId: 'us-census-cps',
      theme: 'voting-rights',
      raceEthnicitySlice: 'asian',
    },
  };

  // Add all series
  Object.values(turnoutSeries).forEach((s) => series.push(s));

  // Parse CSV data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const row = parseCsvLine(line, headers);
      const year = parseInt(row.year, 10);

      if (isNaN(year)) {
        rejected.push(`Row ${i + 1}: invalid year: ${row.year}`);
        continue;
      }

      years.add(year);
      const period = String(year);

      // Black turnout
      const blackTurnout = row.black_citizen_pct ? parseFloat(row.black_citizen_pct) : null;
      if (blackTurnout !== null && !isNaN(blackTurnout)) {
        const obsId = `obs:cps-a1-turnout-black-nation:${NATION_JURISDICTION}:${period}`;
        observations.push({
          id: obsId,
          metricId: 'cps-a1-turnout-black-nation',
          jurisdictionId: NATION_JURISDICTION,
          boundaryVersion: 'national',
          referencePeriod: period,
          datasetVintage: '2026-07-24',
          estimate: blackTurnout,
          raceEthnicitySlice: 'black',
          source: 'us-census-cps',
          sourceUrl: CPS_A1_URL,
          retrievedAt: CPS_A1_RETRIEVED,
          contentHash: contentHash,
        });
      }

      // White turnout
      const whiteTurnout = row.white_non_hispanic_citizen_pct
        ? parseFloat(row.white_non_hispanic_citizen_pct)
        : null;
      if (whiteTurnout !== null && !isNaN(whiteTurnout)) {
        const obsId = `obs:cps-a1-turnout-white-nation:${NATION_JURISDICTION}:${period}`;
        observations.push({
          id: obsId,
          metricId: 'cps-a1-turnout-white-nation',
          jurisdictionId: NATION_JURISDICTION,
          boundaryVersion: 'national',
          referencePeriod: period,
          datasetVintage: '2026-07-24',
          estimate: whiteTurnout,
          raceEthnicitySlice: 'white-non-hispanic',
          source: 'us-census-cps',
          sourceUrl: CPS_A1_URL,
          retrievedAt: CPS_A1_RETRIEVED,
          contentHash: contentHash,
        });
      }

      // Hispanic turnout
      const hispanicTurnout = row.hispanic_citizen_pct
        ? parseFloat(row.hispanic_citizen_pct)
        : null;
      if (hispanicTurnout !== null && !isNaN(hispanicTurnout)) {
        const obsId = `obs:cps-a1-turnout-hispanic-nation:${NATION_JURISDICTION}:${period}`;
        observations.push({
          id: obsId,
          metricId: 'cps-a1-turnout-hispanic-nation',
          jurisdictionId: NATION_JURISDICTION,
          boundaryVersion: 'national',
          referencePeriod: period,
          datasetVintage: '2026-07-24',
          estimate: hispanicTurnout,
          raceEthnicitySlice: 'hispanic',
          source: 'us-census-cps',
          sourceUrl: CPS_A1_URL,
          retrievedAt: CPS_A1_RETRIEVED,
          contentHash: contentHash,
        });
      }

      // Asian turnout
      const asianTurnout = row.asian_citizen_pct ? parseFloat(row.asian_citizen_pct) : null;
      if (asianTurnout !== null && !isNaN(asianTurnout)) {
        const obsId = `obs:cps-a1-turnout-asian-nation:${NATION_JURISDICTION}:${period}`;
        observations.push({
          id: obsId,
          metricId: 'cps-a1-turnout-asian-nation',
          jurisdictionId: NATION_JURISDICTION,
          boundaryVersion: 'national',
          referencePeriod: period,
          datasetVintage: '2026-07-24',
          estimate: asianTurnout,
          raceEthnicitySlice: 'asian',
          source: 'us-census-cps',
          sourceUrl: CPS_A1_URL,
          retrievedAt: CPS_A1_RETRIEVED,
          contentHash: contentHash,
        });
      }
    } catch (error) {
      rejected.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    observations,
    series,
    fixturePath,
    sourceUrl: CPS_A1_URL,
    retrievedAt: CPS_A1_RETRIEVED,
    contentHash,
    years: [...years].sort((a, b) => a - b),
    rejected,
  };
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
  observations: readonly CpsObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly CpsObservationDraft[];
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
  series: readonly CpsSeriesDraft[],
  observations: readonly CpsObservationDraft[],
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

    for (const s of series) {
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
          s.metricId,
          s.metricDefinition,
          s.universe,
          s.unit,
          s.sourceDataset,
          s.sourceTable,
          s.sourceVariable,
          s.geographyType,
          s.estimateType,
          s.periodType,
          s.externalDataSourceId,
          s.theme,
          JSON.stringify({
            raceEthnicitySlice: s.raceEthnicitySlice ?? null,
            methodologyNote:
              'Census CPS Historical Reported Voting Rates Table A-1; citizen voting-age population.',
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
          JSON.stringify({}),
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
  const apply = process.env.INGEST_PHASE1_CPS_A1_APPLY === '1' && process.env.DRY_RUN !== '1';
  const fixturePath = arg('cps-fixture-csv') ?? DEFAULT_FIXTURE;

  if (!existsSync(fixturePath)) {
    throw new Error(`CPS A-1 fixture not found: ${fixturePath}`);
  }

  const fetchResult = fetchCpsA1Observations({
    fixtureCsvText: readFileSync(fixturePath, 'utf8'),
    fixturePath,
  });

  const byMetric = new Map<string, number>();
  for (const obs of fetchResult.observations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    years: fetchResult.years,
    fetchedObservations: fetchResult.observations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejectedParseRows: fetchResult.rejected.length,
    fixturePath: fetchResult.fixturePath,
    sourceUrl: fetchResult.sourceUrl,
    retrievedAt: fetchResult.retrievedAt,
    contentHash: fetchResult.contentHash,
    seriesCount: fetchResult.series.length,
  };

  if (fetchResult.rejected.length > 0) {
    summary.rejectedSample = fetchResult.rejected.slice(0, 5);
  }

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_CPS_A1_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
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

  const written = await applyObservations(fetchResult.series, accepted, databaseUrl);
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

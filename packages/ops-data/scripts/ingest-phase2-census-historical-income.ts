/**
 * Census Bureau historical income and poverty ingest for Phase 2 national spine series.
 * Ingests from Census CPS Historical Income Tables (H-5) and Historical Poverty Tables (Table 2)
 * into bb_reference.statistical_observations for national-level time-series analysis.
 *
 * Sources:
 *   - Table H-5: https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx
 *     "Race and Hispanic Origin of Householder--Households by Median and Mean Income: 1967 to 2024"
 *   - Table 2: https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-poverty-people/hstpov2.xlsx
 *     "Poverty Status of People by Family Relationship, Race, and Hispanic Origin: 1959 to 2024"
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase2-census-historical-income.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE2_CENSUS_HISTORICAL_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase2-census-historical-income.ts
 *
 *   # Custom income/poverty fixture CSVs
 *   CENSUS_INCOME_FIXTURE=/path/to/h05.csv \
 *   CENSUS_POVERTY_FIXTURE=/path/to/table2.csv \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase2-census-historical-income.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// TODO: Create these domain adapters when data extraction is complete
// import {
//   fetchPhase2CensusHistoricalIncomeObservations,
//   fetchPhase2CensusHistoricalPovertyObservations,
//   listPhase2CensusHistoricalIndicators,
//   CENSUS_BUREAU_INCOME_TABLE_URL,
//   CENSUS_BUREAU_POVERTY_TABLE_URL,
// } from '@repo/domain';

const DEFAULT_INCOME_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/census-h5-median-hh-income-by-race-1967-2024.csv',
);
const DEFAULT_POVERTY_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/census-p2-poverty-rate-by-race-1959-2024.csv',
);

const CENSUS_BUREAU_INCOME_TABLE_URL =
  'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx';
const CENSUS_BUREAU_POVERTY_TABLE_URL =
  'https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-poverty-people/hstpov2.xlsx';

// Metric IDs from phase1-indicator-catalog.ts
const METRIC_IDS = {
  INCOME_BLACK: 'census-h5-median-hh-income-black-nation',
  INCOME_WHITE_NH: 'census-h5-median-hh-income-white-nh-nation',
  POVERTY_BLACK: 'census-p2-poverty-rate-black-nation',
  POVERTY_WHITE_NH: 'census-p2-poverty-rate-white-nh-nation',
};

const NATIONAL_JURISDICTION_ID = 'nation:US';

/**
 * Canonical value fingerprint for a statistical observation: full sha256 hex of
 * a stable serialization of (metricId, referencePeriod, estimate). referencePeriod
 * is the string form used on the stored row so the same hash is reproducible from
 * the row alone (see scripts/backfill-census-income-hashes.ts). Replaces an
 * earlier broken formula that base64-truncated to 12 chars — identical across all
 * rows and not a hash — which wrote 222 placeholder 'eyJtZXRyaWNJ' content_hashes.
 */
function observationContentHash(
  metricId: string,
  referencePeriod: string,
  estimate: number,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ metricId, referencePeriod, estimate }))
    .digest('hex');
}
const DATASET_VINTAGE = 'Census CPS 1967-2024 (2025 release)';
const CENSUS_HISTORICAL_INCOME_BOUNDARY_VERSION = 'nation-2024';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

type CensusObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

/**
 * Parse a simplified Census income CSV fixture.
 * Expected format:
 *   Year,Race,MetricId,MedianIncome2024Dollars
 *   2024,Black Alone,census-h5-median-hh-income-black-nation,56000
 *   2024,White Alone Not Hispanic,census-h5-median-hh-income-white-nh-nation,89000
 */
function parseCensusIncomeCsv(csvText: string): {
  readonly observations: readonly CensusObservationDraft[];
  readonly rejected: readonly string[];
  readonly years: readonly number[];
} {
  const lines = csvText.trim().split('\n');
  const observations: CensusObservationDraft[] = [];
  const rejected: string[] = [];
  const yearsSet = new Set<number>();
  const retrievedAt = new Date().toISOString();

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 4) {
      rejected.push(`Row ${i + 1}: insufficient columns`);
      continue;
    }

    const [yearStr, race, metricId, medianIncomeStr] = parts.map((p) => p.trim());
    const year = parseInt(yearStr, 10);
    const estimate = parseFloat(medianIncomeStr);

    if (isNaN(year) || isNaN(estimate)) {
      rejected.push(`Row ${i + 1}: invalid year or estimate`);
      continue;
    }

    yearsSet.add(year);

    const raceEthnicitySlice =
      race === 'Black Alone' ? 'black_alone' : 'white_nonhispanic';

    const id = `${metricId}:${NATIONAL_JURISDICTION_ID}:${year}`;
    const contentHash = observationContentHash(metricId, `${year}`, estimate);

    observations.push({
      id,
      metricId,
      referencePeriod: `${year}`,
      estimate,
      raceEthnicitySlice,
      source: 'U.S. Census Bureau',
      sourceUrl: CENSUS_BUREAU_INCOME_TABLE_URL,
      retrievedAt,
      contentHash,
    });
  }

  return {
    observations,
    rejected,
    years: Array.from(yearsSet).sort((a, b) => a - b),
  };
}

/**
 * Parse a simplified Census poverty CSV fixture.
 * Expected format:
 *   Year,Race,MetricId,PovertyRate
 *   2024,Black Alone,census-p2-poverty-rate-black-nation,17.0
 *   2024,White Alone Not Hispanic,census-p2-poverty-rate-white-nh-nation,8.0
 */
function parseCensusPovertyCsv(csvText: string): {
  readonly observations: readonly CensusObservationDraft[];
  readonly rejected: readonly string[];
  readonly years: readonly number[];
} {
  const lines = csvText.trim().split('\n');
  const observations: CensusObservationDraft[] = [];
  const rejected: string[] = [];
  const yearsSet = new Set<number>();
  const retrievedAt = new Date().toISOString();

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 4) {
      rejected.push(`Row ${i + 1}: insufficient columns`);
      continue;
    }

    const [yearStr, race, metricId, povertyRateStr] = parts.map((p) => p.trim());
    const year = parseInt(yearStr, 10);
    const estimate = parseFloat(povertyRateStr);

    if (isNaN(year) || isNaN(estimate)) {
      rejected.push(`Row ${i + 1}: invalid year or rate`);
      continue;
    }

    yearsSet.add(year);

    const raceEthnicitySlice =
      race === 'Black Alone' ? 'black_alone' : 'white_nonhispanic';

    const id = `${metricId}:${NATIONAL_JURISDICTION_ID}:${year}`;
    const contentHash = observationContentHash(metricId, `${year}`, estimate);

    observations.push({
      id,
      metricId,
      referencePeriod: `${year}`,
      estimate,
      raceEthnicitySlice,
      source: 'U.S. Census Bureau',
      sourceUrl: CENSUS_BUREAU_POVERTY_TABLE_URL,
      retrievedAt,
      contentHash,
    });
  }

  return {
    observations,
    rejected,
    years: Array.from(yearsSet).sort((a, b) => a - b),
  };
}

async function applyObservations(
  observations: readonly CensusObservationDraft[],
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

    // Upsert statistical series for all four metrics
    const seriesDefinitions = [
      {
        metricId: METRIC_IDS.INCOME_BLACK,
        metricDefinition: 'Median household income for Black householders (Census H-5)',
        universe: 'households',
        unit: 'USD',
        sourceDataset: 'Census Current Population Survey Historical Income Tables',
        sourceTable: 'H-5',
        sourceVariable: 'H-5 median income',
        geographyType: 'nation',
        estimateType: 'median',
        periodType: 'annual',
        externalDataSourceId: 'census-historical-income-poverty',
        raceEthnicitySlice: 'black_alone',
      },
      {
        metricId: METRIC_IDS.INCOME_WHITE_NH,
        metricDefinition:
          'Median household income for White non-Hispanic householders (Census H-5)',
        universe: 'households',
        unit: 'USD',
        sourceDataset: 'Census Current Population Survey Historical Income Tables',
        sourceTable: 'H-5',
        sourceVariable: 'H-5 median income',
        geographyType: 'nation',
        estimateType: 'median',
        periodType: 'annual',
        externalDataSourceId: 'census-historical-income-poverty',
        raceEthnicitySlice: 'white_nonhispanic',
      },
      {
        metricId: METRIC_IDS.POVERTY_BLACK,
        metricDefinition: 'Poverty rate for Black population (Census Table 2)',
        universe: 'population for whom poverty status is determined',
        unit: 'percent',
        sourceDataset: 'Census Current Population Survey Historical Poverty Tables',
        sourceTable: '2',
        sourceVariable: 'Table 2 poverty rate',
        geographyType: 'nation',
        estimateType: 'percentage',
        periodType: 'annual',
        externalDataSourceId: 'census-historical-income-poverty',
        raceEthnicitySlice: 'black_alone',
      },
      {
        metricId: METRIC_IDS.POVERTY_WHITE_NH,
        metricDefinition: 'Poverty rate for White non-Hispanic population (Census Table 2)',
        universe: 'population for whom poverty status is determined',
        unit: 'percent',
        sourceDataset: 'Census Current Population Survey Historical Poverty Tables',
        sourceTable: '2',
        sourceVariable: 'Table 2 poverty rate',
        geographyType: 'nation',
        estimateType: 'percentage',
        periodType: 'annual',
        externalDataSourceId: 'census-historical-income-poverty',
        raceEthnicitySlice: 'white_nonhispanic',
      },
    ];

    for (const series of seriesDefinitions) {
      await client.query(
        `INSERT INTO bb_reference.statistical_series
          (metric_id, metric_definition, universe, unit, source_dataset, source_table,
           source_variable, geography_type, estimate_type, period_type,
           external_data_source_id, theme, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'wealth',$12::jsonb)
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
          JSON.stringify({
            raceEthnicitySlice: series.raceEthnicitySlice,
            methodologyNote:
              'Census Current Population Survey historical tables: income in 2024 constant dollars, poverty rates as percent of population.',
            sourceIncome: CENSUS_BUREAU_INCOME_TABLE_URL,
            sourcePoverty: CENSUS_BUREAU_POVERTY_TABLE_URL,
          }),
        ],
      );
    }

    // Upsert observations
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
          NATIONAL_JURISDICTION_ID,
          CENSUS_HISTORICAL_INCOME_BOUNDARY_VERSION,
          obs.referencePeriod,
          DATASET_VINTAGE,
          obs.estimate,
          null, // Census historical tables don't provide MOE for aggregates
          obs.raceEthnicitySlice,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            censusBureauSource: true,
            inflationAdjustedToYear: 2024,
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
  const apply = process.env.INGEST_PHASE2_CENSUS_HISTORICAL_APPLY === '1' &&
    process.env.DRY_RUN !== '1';
  const incomeFixturePath = arg('income-fixture') ||
    process.env.CENSUS_INCOME_FIXTURE ||
    DEFAULT_INCOME_FIXTURE;
  const povertyFixturePath = arg('poverty-fixture') ||
    process.env.CENSUS_POVERTY_FIXTURE ||
    DEFAULT_POVERTY_FIXTURE;

  // For now, log what would be needed
  if (!existsSync(incomeFixturePath)) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          dryRun: !apply,
          error: 'missing_income_fixture',
          message: `Income fixture not found: ${incomeFixturePath}`,
          expected_format: 'CSV with columns: Year,Race,MetricId,MedianIncome2024Dollars',
          note: 'Extract from Census Table H-5 Excel file',
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!existsSync(povertyFixturePath)) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          dryRun: !apply,
          error: 'missing_poverty_fixture',
          message: `Poverty fixture not found: ${povertyFixturePath}`,
          expected_format: 'CSV with columns: Year,Race,MetricId,PovertyRate',
          note: 'Extract from Census Table 2 (HSTPOV2) Excel file',
        },
        null,
        2,
      ),
    );
    return;
  }

  const incomeResult = parseCensusIncomeCsv(readFileSync(incomeFixturePath, 'utf8'));
  const povertyResult = parseCensusPovertyCsv(readFileSync(povertyFixturePath, 'utf8'));

  const allObservations = [...incomeResult.observations, ...povertyResult.observations];
  const byMetric = new Map<string, number>();
  for (const obs of allObservations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  // Sanity checks
  const incomeBlackObs = incomeResult.observations.filter((o) =>
    o.metricId === METRIC_IDS.INCOME_BLACK
  );
  const incomeWhiteNhObs = incomeResult.observations.filter((o) =>
    o.metricId === METRIC_IDS.INCOME_WHITE_NH
  );

  let sanityCheckNote = '';
  if (incomeBlackObs.length > 0 && incomeWhiteNhObs.length > 0) {
    const newestBlack = incomeBlackObs.reduce((a, b) =>
      a.referencePeriod > b.referencePeriod ? a : b
    );
    const newestWhiteNh = incomeWhiteNhObs.reduce((a, b) =>
      a.referencePeriod > b.referencePeriod ? a : b
    );
    const ratio = newestBlack.estimate / newestWhiteNh.estimate;

    sanityCheckNote =
      `Recent (${newestBlack.referencePeriod}): Black $${newestBlack.estimate}k, White NH $${newestWhiteNh.estimate}k, ratio=${ratio.toFixed(2)}. ` +
      `Expected ratio 0.58-0.65.`;
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    fetchedObservations: allObservations.length,
    incomeYears: incomeResult.years,
    povertyYears: povertyResult.years,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejectedIncome: incomeResult.rejected.length,
    rejectedPoverty: povertyResult.rejected.length,
    incomeFixturePath,
    povertyFixturePath,
    censusBureauSourceIncome: CENSUS_BUREAU_INCOME_TABLE_URL,
    censusBureauSourcePoverty: CENSUS_BUREAU_POVERTY_TABLE_URL,
    sanityCheck: sanityCheckNote,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE2_CENSUS_HISTORICAL_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const written = await applyObservations(allObservations, databaseUrl);
  summary.appliedObservations = written;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

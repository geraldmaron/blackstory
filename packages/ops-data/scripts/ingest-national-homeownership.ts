/**
 * National homeownership rate by race ingest for Phase 1 observations into
 * bb_reference.statistical_observations. Uses curated decennial (1900-2000)
 * and ACS 1-year (2005-2024) national fixtures.
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-national-homeownership.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_NATIONAL_HOMEOWNERSHIP_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-national-homeownership.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DECENNIAL_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/census-national-homeownership-by-race-1900-2000.csv',
);
const DEFAULT_ACS_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/acs-national-homeownership-by-race-2005-2024.csv',
);

interface NationalHomeownershipObservation {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError?: number;
  readonly raceEthnicitySlice: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

interface SeriesDefinition {
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
  readonly raceEthnicitySlice: string;
}

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

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function observationId(metricId: string, referencePeriod: string): string {
  return `obs:${metricId}:nation:US:${referencePeriod}`;
}

function contentHash(parts: {
  readonly metricId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
}): string {
  return sha256(JSON.stringify(parts));
}

function raceSlice(race: string): string {
  if (race === 'black') return 'black';
  if (race === 'white_nh') return 'white_nh';
  throw new Error(`Unknown race: ${race}`);
}

function parseDecennialCsv(csvText: string): Array<{
  readonly decade: number;
  readonly race: string;
  readonly homeownershipRate: number;
  readonly sourceUrl: string;
}> {
  const lines = csvText.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(',');
    if (parts.length < 4) continue;
    if (parts[0] === 'decade') continue; // header

    const decade = parseInt(parts[0]!, 10);
    const race = parts[1]!.trim();
    const rate = parseFloat(parts[2]!);
    const sourceUrl = parts[3]!.trim();

    if (!Number.isFinite(decade) || !Number.isFinite(rate)) continue;

    result.push({ decade, race, homeownershipRate: rate, sourceUrl });
  }

  return result;
}

function parseAcsCsv(csvText: string): Array<{
  readonly year: number;
  readonly race: string;
  readonly homeownershipRate: number;
  readonly marginOfError: number;
  readonly sourceUrl: string;
}> {
  const lines = csvText.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(',');
    if (parts.length < 5) continue;
    if (parts[0] === 'year') continue; // header

    const year = parseInt(parts[0]!, 10);
    const race = parts[1]!.trim();
    const rate = parseFloat(parts[2]!);
    const moe = parseFloat(parts[3]!);
    const sourceUrl = parts[4]!.trim();

    if (!Number.isFinite(year) || !Number.isFinite(rate)) continue;

    result.push({ year, race, homeownershipRate: rate, marginOfError: moe, sourceUrl });
  }

  return result;
}

function buildDecennialObservations(rows: Array<{
  readonly decade: number;
  readonly race: string;
  readonly homeownershipRate: number;
  readonly sourceUrl: string;
}>): NationalHomeownershipObservation[] {
  const observations: NationalHomeownershipObservation[] = [];

  for (const row of rows) {
    const race = raceSlice(row.race);
    const metricId = `census-decennial-homeownership-${race}-nation`;
    const referencePeriod = `${row.decade}`;
    const id = observationId(metricId, referencePeriod);

    observations.push({
      id,
      metricId,
      jurisdictionId: 'nation:US',
      boundaryVersion: 'nation-2020',
      referencePeriod,
      datasetVintage: `decennial-${row.decade}`,
      estimate: row.homeownershipRate,
      raceEthnicitySlice: race,
      source: 'Census Bureau Historical Census of Housing Tables',
      sourceUrl: row.sourceUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: contentHash({
        metricId,
        referencePeriod,
        estimate: row.homeownershipRate,
      }),
    });
  }

  return observations;
}

function buildAcsObservations(rows: Array<{
  readonly year: number;
  readonly race: string;
  readonly homeownershipRate: number;
  readonly marginOfError: number;
  readonly sourceUrl: string;
}>): NationalHomeownershipObservation[] {
  const observations: NationalHomeownershipObservation[] = [];

  for (const row of rows) {
    const race = raceSlice(row.race);
    const metricId = `acs-homeownership-rate-${race}-nation`;
    const referencePeriod = `${row.year}`;
    const id = observationId(metricId, referencePeriod);

    observations.push({
      id,
      metricId,
      jurisdictionId: 'nation:US',
      boundaryVersion: 'nation-2020',
      referencePeriod,
      datasetVintage: `acs-1year-${row.year}`,
      estimate: row.homeownershipRate,
      marginOfError: row.marginOfError,
      raceEthnicitySlice: race,
      source: 'ACS 1-Year Detailed Tables',
      sourceUrl: row.sourceUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: contentHash({
        metricId,
        referencePeriod,
        estimate: row.homeownershipRate,
      }),
    });
  }

  return observations;
}

function buildSeriesDefinitions(): SeriesDefinition[] {
  return [
    {
      metricId: 'census-decennial-homeownership-black-nation',
      metricDefinition: 'Homeownership rate for Black householders (decennial Census historical tables)',
      universe: 'occupied housing units with Black householder',
      unit: 'percent',
      sourceDataset: 'Census Bureau Historical Census of Housing Tables',
      sourceTable: 'Homeownership by Race and Hispanic Origin',
      sourceVariable: 'homeowner_occupied_black / occupied_black',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'decennial',
      externalDataSourceId: 'census-historical-housing-tables',
      theme: 'housing',
      raceEthnicitySlice: 'black',
    },
    {
      metricId: 'census-decennial-homeownership-white-nh-nation',
      metricDefinition: 'Homeownership rate for White Non-Hispanic householders (decennial Census historical tables)',
      universe: 'occupied housing units with White Non-Hispanic householder',
      unit: 'percent',
      sourceDataset: 'Census Bureau Historical Census of Housing Tables',
      sourceTable: 'Homeownership by Race and Hispanic Origin',
      sourceVariable: 'homeowner_occupied_white / occupied_white',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'decennial',
      externalDataSourceId: 'census-historical-housing-tables',
      theme: 'housing',
      raceEthnicitySlice: 'white_nh',
    },
    {
      metricId: 'acs-homeownership-rate-black-nation',
      metricDefinition: 'Homeownership rate for Black or African American alone householders (ACS 1-Year)',
      universe: 'occupied housing units',
      unit: 'percent',
      sourceDataset: 'ACS 1-Year Detailed Tables',
      sourceTable: 'B25003B',
      sourceVariable: 'derived',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'annual',
      externalDataSourceId: 'acs-census-api',
      theme: 'housing',
      raceEthnicitySlice: 'black',
    },
    {
      metricId: 'acs-homeownership-rate-white-nh-nation',
      metricDefinition: 'Homeownership rate for White alone Non-Hispanic householders (ACS 1-Year)',
      universe: 'occupied housing units',
      unit: 'percent',
      sourceDataset: 'ACS 1-Year Detailed Tables',
      sourceTable: 'B25003H',
      sourceVariable: 'derived',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'annual',
      externalDataSourceId: 'acs-census-api',
      theme: 'housing',
      raceEthnicitySlice: 'white_nh',
    },
  ];
}

async function applyObservations(
  observations: readonly NationalHomeownershipObservation[],
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

    for (const series of buildSeriesDefinitions()) {
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
            raceEthnicitySlice: series.raceEthnicitySlice,
            methodologyNote: 'National homeownership rate by race, 1900-2024 spine.',
            sourceNote: 'Decennial 1900-2000 from Census Bureau historical tables; ACS 1-Year 2005-2024 (no 2020 standard release).',
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
           margin_of_error = EXCLUDED.margin_of_error,
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
          obs.marginOfError ?? null,
          obs.raceEthnicitySlice,
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
  const apply = process.env.INGEST_NATIONAL_HOMEOWNERSHIP_APPLY === '1' && process.env.DRY_RUN !== '1';
  const decennialFixturePath = DEFAULT_DECENNIAL_FIXTURE;
  const acsFixturePath = DEFAULT_ACS_FIXTURE;

  if (!existsSync(decennialFixturePath)) {
    throw new Error(`Decennial fixture not found: ${decennialFixturePath}`);
  }
  if (!existsSync(acsFixturePath)) {
    throw new Error(`ACS fixture not found: ${acsFixturePath}`);
  }

  const decennialCsv = readFileSync(decennialFixturePath, 'utf8');
  const acsCsv = readFileSync(acsFixturePath, 'utf8');

  const decennialRows = parseDecennialCsv(decennialCsv);
  const acsRows = parseAcsCsv(acsCsv);

  const decennialObservations = buildDecennialObservations(decennialRows);
  const acsObservations = buildAcsObservations(acsRows);

  const allObservations = [...decennialObservations, ...acsObservations];
  const byMetric = new Map<string, number>();
  for (const obs of allObservations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  // Sanity checks
  const blackDecennial2000 = decennialObservations.find(
    (o) => o.metricId.includes('black') && o.referencePeriod === '2000',
  );
  const blackAcs2023 = acsObservations.find(
    (o) => o.metricId.includes('black') && o.referencePeriod === '2023',
  );
  const whiteNhAcs2023 = acsObservations.find(
    (o) => o.metricId.includes('white_nh') && o.referencePeriod === '2023',
  );

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    fetchedObservations: allObservations.length,
    decennialObservations: decennialObservations.length,
    acsObservations: acsObservations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    sanityChecks: {
      blackHomeownership2000: blackDecennial2000?.estimate,
      blackHomeownership2023: blackAcs2023?.estimate,
      whiteNhHomeownership2023: whiteNhAcs2023?.estimate,
      expectedBlack2000Range: '46-47%',
      expectedBlack2023Range: '45-46%',
      expectedWhiteNh2023Range: '74%',
    },
    fixtures: {
      decennial: decennialFixturePath,
      acs: acsFixturePath,
    },
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_NATIONAL_HOMEOWNERSHIP_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
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

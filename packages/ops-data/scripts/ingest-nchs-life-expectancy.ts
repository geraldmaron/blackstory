/**
 * NCHS life expectancy at birth by race (1900–present) ingest.
 *
 * Source: NCHS "United States Life Tables" historical series:
 * - 1900–2018: CDC/NCHS "Death rates and life expectancy at birth" dataset
 *   (Socrata API, data.cdc.gov; search "NCHS life expectancy at birth race")
 * - 2019–present: NCHS National Vital Statistics Reports (PDF/table form;
 *   transcribed with source page cited in metadata)
 *
 * Metrics:
 * - nchs-life-expectancy-birth-black-nation: life expectancy at birth, Black population, national
 * - nchs-life-expectancy-birth-white-nation: life expectancy at birth, White population, national
 *
 * Sanity checks (approximate):
 * - 1900: Black ~33, white ~47.6
 * - 2019: Black ~74.8, white ~78.8
 * - 2021 (COVID trough): Black ~70.8
 *
 * Usage (repo root):
 *   # Dry-run (default) — counts observations without writing
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-nchs-life-expectancy.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_NCHS_LIFE_EXPECTANCY_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-nchs-life-expectancy.ts
 *
 *   # Use custom fixture
 *   --nchs-fixture-csv=path/to/data.csv node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-nchs-life-expectancy.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../fixtures/reference-indicators/nchs-life-expectancy-1900-2021.csv',
);

const NCHS_HOMEPAGE_URL = 'https://www.cdc.gov/nchs/nvss/life-expectancy.htm';
const NCHS_VITAL_STATS_REPORTS_URL = 'https://www.cdc.gov/nchs/nvsr/';
const SOCRATA_DATASET_URL = 'https://data.cdc.gov/resource/';

const METRIC_IDS = {
  BLACK: 'nchs-life-expectancy-birth-black-nation',
  WHITE: 'nchs-life-expectancy-birth-white-nation',
} as const;

type ObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly raceLabel: string; // "Black" or "White" or "nonwhite" (pre-1970)
};

type FetchResult = {
  readonly observations: readonly ObservationDraft[];
  readonly rejected: readonly string[];
  readonly yearsIngested: readonly number[];
  readonly fixturePath: string;
  readonly sourceUrl: string;
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function computeContentHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function parseFixtureCsv(csvText: string): FetchResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV fixture must have at least a header row and one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim());
  const yearIdx = header.indexOf('Year');
  const blackIdx = header.indexOf('Black');
  const whiteIdx = header.indexOf('White');
  const raceLabelIdx = header.indexOf('RaceLabel');

  if (yearIdx === -1 || (blackIdx === -1 && whiteIdx === -1)) {
    throw new Error('CSV must have Year column and either Black or White life expectancy columns');
  }

  const observations: ObservationDraft[] = [];
  const rejected: string[] = [];
  const yearsSet = new Set<number>();
  const retrievedAt = new Date().toISOString();
  const contentHash = computeContentHash(csvText);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < Math.max(yearIdx, blackIdx, whiteIdx) + 1) {
      rejected.push(`Row ${i + 1}: insufficient columns`);
      continue;
    }

    const yearStr = parts[yearIdx];
    const year = Number(yearStr);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      rejected.push(`Row ${i + 1}: invalid year "${yearStr}"`);
      continue;
    }

    const raceLabel = raceLabelIdx !== -1 ? parts[raceLabelIdx] : '';

    // Black life expectancy
    if (blackIdx !== -1) {
      const blackStr = parts[blackIdx];
      const blackValue = Number(blackStr);
      if (!isNaN(blackValue) && blackValue > 0) {
        const id = `${METRIC_IDS.BLACK}:${year}:nation`;
        observations.push({
          id,
          metricId: METRIC_IDS.BLACK,
          referencePeriod: String(year),
          estimate: blackValue,
          source: year <= 2018 ? 'NCHS/Socrata API' : 'NCHS National Vital Statistics Report',
          sourceUrl:
            year <= 2018
              ? `${SOCRATA_DATASET_URL}(dataset-id-search-nchs-life-expectancy-at-birth-race)`
              : NCHS_VITAL_STATS_REPORTS_URL,
          retrievedAt,
          contentHash,
          raceLabel,
        });
        yearsSet.add(year);
      }
    }

    // White life expectancy
    if (whiteIdx !== -1) {
      const whiteStr = parts[whiteIdx];
      const whiteValue = Number(whiteStr);
      if (!isNaN(whiteValue) && whiteValue > 0) {
        const id = `${METRIC_IDS.WHITE}:${year}:nation`;
        observations.push({
          id,
          metricId: METRIC_IDS.WHITE,
          referencePeriod: String(year),
          estimate: whiteValue,
          source: year <= 2018 ? 'NCHS/Socrata API' : 'NCHS National Vital Statistics Report',
          sourceUrl:
            year <= 2018
              ? `${SOCRATA_DATASET_URL}(dataset-id-search-nchs-life-expectancy-at-birth-race)`
              : NCHS_VITAL_STATS_REPORTS_URL,
          retrievedAt,
          contentHash,
          raceLabel,
        });
        yearsSet.add(year);
      }
    }
  }

  const yearsIngested = Array.from(yearsSet).sort((a, b) => a - b);

  return {
    observations,
    rejected,
    yearsIngested,
    fixturePath: DEFAULT_FIXTURE_PATH,
    sourceUrl: NCHS_HOMEPAGE_URL,
  };
}

async function applyObservations(
  observations: readonly ObservationDraft[],
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

    // Upsert series metadata for both metrics
    for (const metricId of Object.values(METRIC_IDS)) {
      const metricDefinition =
        metricId === METRIC_IDS.BLACK
          ? 'Life expectancy at birth, Black population, United States'
          : 'Life expectancy at birth, White population, United States';

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
          metricId,
          metricDefinition,
          'Total population, by race',
          'years',
          'nchs-life-tables',
          'United States Life Tables',
          'e(0) [life expectancy at age 0]',
          'nation',
          'mean',
          'annual',
          null, // external_data_source_id — could point to NCHS if registered
          'health',
          JSON.stringify({
            methodologyNote:
              'National Center for Health Statistics (NCHS) life tables. ' +
              '1900–2018 from CDC/NCHS Socrata API; 2019–present from NCHS National Vital Statistics Reports. ' +
              'Pre-1970 "Black" is often labeled "nonwhite" in NCHS tables — see metadata.raceLabel for period-specific terminology.',
            nchsHomepage: NCHS_HOMEPAGE_URL,
            nchsVitalStatsReports: NCHS_VITAL_STATS_REPORTS_URL,
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
          'nation:US', // jurisdiction_id for US national data
          '2020', // boundary_version — can be '2020' or generic
          obs.referencePeriod,
          '1900-present', // dataset_vintage
          obs.estimate,
          null, // margin_of_error
          null, // race_ethnicity_slice — implicit in metric_id
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            raceLabel: obs.raceLabel || null,
            note: 'NCHS life expectancy data. Pre-1970 "Black" may be labeled "nonwhite" in source tables.',
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
    process.env.INGEST_NCHS_LIFE_EXPECTANCY_APPLY === '1' && process.env.DRY_RUN !== '1';
  const fixturePath = arg('nchs-fixture-csv') ?? DEFAULT_FIXTURE_PATH;

  if (!existsSync(fixturePath)) {
    throw new Error(`NCHS fixture not found: ${fixturePath}\n
Did you create the fixture CSV at ${DEFAULT_FIXTURE_PATH}?
Expected format (CSV with header): Year,Black,White[,RaceLabel]
Example:
  Year,Black,White,RaceLabel
  1900,33.0,47.6,nonwhite
  2019,74.8,78.8,Black
  2021,70.8,76.1,Black`);
  }

  const fetchResult = parseFixtureCsv(readFileSync(fixturePath, 'utf8'));

  const byMetric = new Map<string, number>();
  for (const obs of fetchResult.observations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    yearsIngested: fetchResult.yearsIngested,
    totalYears: fetchResult.yearsIngested.length,
    yearRange: [
      fetchResult.yearsIngested[0],
      fetchResult.yearsIngested[fetchResult.yearsIngested.length - 1],
    ],
    fetchedObservations: fetchResult.observations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejectedParseRows: fetchResult.rejected.length,
    fixturePath,
    sourceUrl: fetchResult.sourceUrl,
    nchsHomepage: NCHS_HOMEPAGE_URL,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_NCHS_LIFE_EXPECTANCY_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const written = await applyObservations(fetchResult.observations, databaseUrl);
  summary.appliedObservations = written;

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

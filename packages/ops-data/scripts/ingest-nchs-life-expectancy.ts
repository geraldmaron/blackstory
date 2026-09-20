/**
 * NCHS life expectancy at birth by race, national, selected years 1900 to 2021.
 *
 * EVERY VALUE IS TRANSCRIBED FROM A NAMED NCHS PUBLICATION, row by row, in the fixture CSV:
 * - 1900 to 2017: the NCHS open dataset "Death rates and life expectancy at birth"
 *   (https://data.cdc.gov/d/w9j2-ggv5, public domain). The fixture's values were generated from
 *   the dataset's own API response, not typed.
 * - 2018 to 2021: the Results abstract of "United States Life Tables" for each year
 *   (National Vital Statistics Reports 69-12, 70-19, 71-1, 72-12).
 *
 * WHY THIS HEADER IS BLUNT. Until 2026-09-20 the fixture held values typed from memory and the
 * rows cited a placeholder URL. Eleven of twenty years disagreed with NCHS (Black 1910 was 34.1
 * against NCHS's 35.6; Black 2000 was 71.3 against 71.8; 2021 held provisional figures). Do not
 * add a year to the fixture without opening the publication it comes from.
 *
 * THREE POPULATIONS SHARE EACH METRIC ID, AND THE SEAMS ARE NOT OPTIONAL CONTEXT:
 * - 1900 to 1969, the "Black" series is the NONWHITE population. NCHS, United States Life Tables,
 *   2017 (NVSR 68-7), Table 19, footnote 1: "Before 1970, data for the black population are not
 *   available. Data shown for 1900–1969 are for the nonwhite population."
 * - 1970 to 2017, it is the Black population, all origins.
 * - 2018 on, NCHS reports the NON-HISPANIC SINGLE-RACE Black and White populations. The white
 *   series changes definition here too.
 * Each observation carries its own population label in metadata.raceLabel, and any surface that
 * shows these figures must show the label beside them.
 *
 * Metrics:
 * - nchs-life-expectancy-birth-black-nation
 * - nchs-life-expectancy-birth-white-nation
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
const NCHS_DATASET_URL = 'https://data.cdc.gov/d/w9j2-ggv5';
/** NCHS, United States Life Tables, 2017 (NVSR 68-7), Table 19, footnote 1. Verbatim. */
const NCHS_NONWHITE_FOOTNOTE =
  'Before 1970, data for the black population are not available. Data shown for 1900–1969 are for the nonwhite population.';
const NCHS_NONWHITE_FOOTNOTE_URL = 'https://www.cdc.gov/nchs/data/nvsr/nvsr68/nvsr68_07-508.pdf';

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
  /** The population NCHS actually measured for this row: see the header's three populations. */
  readonly raceLabel: string;
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

/** Splits one CSV line, honoring double-quoted fields (publication titles contain commas). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      fields.push(current.trim());
      current = '';
    } else current += char;
  }
  fields.push(current.trim());
  return fields;
}

function parseFixtureCsv(csvText: string): FetchResult {
  const lines = csvText.trim().split('\n');
  const headerLine = lines[0];
  if (lines.length < 2 || headerLine === undefined) {
    throw new Error('CSV fixture must have at least a header row and one data row');
  }

  const header = splitCsvLine(headerLine);
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`CSV fixture is missing the "${name}" column`);
    return index;
  };
  const yearIdx = column('Year');
  const series = [
    { metricId: METRIC_IDS.BLACK, valueIdx: column('Black'), labelIdx: column('BlackLabel') },
    { metricId: METRIC_IDS.WHITE, valueIdx: column('White'), labelIdx: column('WhiteLabel') },
  ] as const;
  const sourceIdx = column('Source');
  const sourceUrlIdx = column('SourceUrl');

  const observations: ObservationDraft[] = [];
  const rejected: string[] = [];
  const yearsSet = new Set<number>();
  const retrievedAt = new Date().toISOString();
  const contentHash = computeContentHash(csvText);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const parts = splitCsvLine(line);
    const year = Number(parts[yearIdx]);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      rejected.push(`Row ${i + 1}: invalid year "${parts[yearIdx]}"`);
      continue;
    }
    const source = parts[sourceIdx] ?? '';
    const sourceUrl = parts[sourceUrlIdx] ?? '';
    if (!source || !/^https:\/\//.test(sourceUrl)) {
      rejected.push(`Row ${i + 1}: every value needs a named publication and an https URL`);
      continue;
    }
    for (const { metricId, valueIdx, labelIdx } of series) {
      const value = Number(parts[valueIdx]);
      const raceLabel = parts[labelIdx] ?? '';
      if (Number.isNaN(value) || value <= 0) continue;
      if (!raceLabel) {
        rejected.push(`Row ${i + 1}: ${metricId} has no population label`);
        continue;
      }
      observations.push({
        id: `${metricId}:${year}:nation`,
        metricId,
        referencePeriod: String(year),
        estimate: value,
        source,
        sourceUrl,
        retrievedAt,
        contentHash,
        raceLabel,
      });
      yearsSet.add(year);
    }
  }

  return {
    observations,
    rejected,
    yearsIngested: Array.from(yearsSet).sort((a, b) => a - b),
    fixturePath: DEFAULT_FIXTURE_PATH,
    sourceUrl: NCHS_DATASET_URL,
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
        `INSERT INTO reference.statistical_series
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
              'NCHS life expectancy at birth. 1900 to 2017 from the NCHS open dataset "Death rates and life expectancy at birth"; ' +
              '2018 on from the United States Life Tables report for each year. Three populations share this metric: ' +
              'nonwhite (1900 to 1969), Black or White of all origins (1970 to 2017), and non-Hispanic single-race (2018 on). ' +
              'Each observation names its population in metadata.raceLabel.',
            nonwhiteFootnote: NCHS_NONWHITE_FOOTNOTE,
            nonwhiteFootnoteUrl: NCHS_NONWHITE_FOOTNOTE_URL,
            nchsHomepage: NCHS_HOMEPAGE_URL,
            nchsDataset: NCHS_DATASET_URL,
          }),
        ],
      );
    }

    // Upsert observations
    for (const obs of observations) {
      await client.query(
        `INSERT INTO reference.statistical_observations
          (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
           estimate, margin_of_error, race_ethnicity_slice, status, source, source_url,
           retrieved_at, content_hash, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'observed',$10,$11,$12::timestamptz,$13,$14::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           estimate = EXCLUDED.estimate,
           source = EXCLUDED.source,
           source_url = EXCLUDED.source_url,
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
            raceLabel: obs.raceLabel,
            ...(obs.raceLabel === 'nonwhite'
              ? { note: NCHS_NONWHITE_FOOTNOTE, noteUrl: NCHS_NONWHITE_FOOTNOTE_URL }
              : {}),
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

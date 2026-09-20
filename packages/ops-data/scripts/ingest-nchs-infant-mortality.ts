/**
 * NCHS infant mortality rates by race, United States, every year 1915 to 2013.
 *
 * Source: the NCHS open dataset "Infant Mortality Rates, by Race: United States, 1915-2013"
 * (https://data.cdc.gov/d/ddsk-zebd, public domain, attribution NCHS/DVS). Deaths under one year
 * of age per 1,000 live births.
 *
 * NOTHING HERE IS TYPED BY HAND. `--refresh-fixture` fetches the dataset's own API response and
 * writes the fixture CSV from it; the ingest then reads that fixture. The life expectancy ingest
 * beside this one shipped values typed from memory and eleven of twenty were wrong, which is why
 * this one cannot be run any other way.
 *
 * THE SEAM NCHS STATES, verbatim from the dataset's description: "All birth data by race before
 * 1980 are based on race of the child; starting in 1980, birth data by race are based on race of
 * the mother. Birth data are used to calculate infant mortality rate." Every observation carries
 * which basis applies in metadata.raceBasis, and any surface showing 1979 beside 1980 must say so.
 *
 * The dataset spells the race "Black " with a trailing space on its 2013 row. Values are trimmed;
 * an unknown race label is rejected, not guessed at.
 *
 * Metrics:
 * - nchs-infant-mortality-black-nation
 * - nchs-infant-mortality-white-nation
 *
 * Usage (repo root):
 *   # Regenerate the fixture from the API (network; writes the CSV only)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-nchs-infant-mortality.ts --refresh-fixture
 *   # Dry run (default): parse the fixture and report
 *   node --conditions development --import tsx packages/ops-data/scripts/ingest-nchs-infant-mortality.ts
 *   # Apply
 *   set -a && . apps/web/.env.local && set +a
 *   DRY_RUN=0 INGEST_NCHS_INFANT_MORTALITY_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-nchs-infant-mortality.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  here,
  '../fixtures/reference-indicators/nchs-infant-mortality-by-race-1915-2013.csv',
);
const DATASET_NAME =
  'NCHS, Infant Mortality Rates, by Race: United States, 1915-2013 (data.cdc.gov dataset ddsk-zebd)';
const DATASET_URL = 'https://data.cdc.gov/d/ddsk-zebd';
const DATASET_API = 'https://data.cdc.gov/resource/ddsk-zebd.json?$limit=5000';
/** The dataset's own description, verbatim. */
const NCHS_RACE_BASIS_NOTE =
  'All birth data by race before 1980 are based on race of the child; starting in 1980, birth data by race are based on race of the mother. Birth data are used to calculate infant mortality rate.';

const METRIC_IDS = {
  Black: 'nchs-infant-mortality-black-nation',
  White: 'nchs-infant-mortality-white-nation',
} as const;
type Race = keyof typeof METRIC_IDS;

export type InfantMortalityRow = {
  readonly year: number;
  readonly race: Race;
  readonly rate: number;
};

/** Parses the dataset's rows. Trims the race, and rejects anything it does not recognize. */
export function parseDatasetRows(rows: readonly Record<string, unknown>[]): {
  readonly parsed: readonly InfantMortalityRow[];
  readonly rejected: readonly string[];
} {
  const parsed: InfantMortalityRow[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const race = String(row.race ?? '').trim();
    const year = Number(row.year);
    const rate = Number(row.infant_mortality_rate);
    if (race !== 'Black' && race !== 'White') {
      rejected.push(`unknown race "${String(row.race)}" in ${String(row.year)}`);
      continue;
    }
    if (!Number.isInteger(year) || year < 1915 || year > 2013) {
      rejected.push(`year out of range: ${String(row.year)}`);
      continue;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      rejected.push(`${race} ${year}: no usable rate`);
      continue;
    }
    const key = `${race}|${year}`;
    if (seen.has(key)) {
      rejected.push(`${race} ${year}: duplicate row`);
      continue;
    }
    seen.add(key);
    parsed.push({ year, race, rate });
  }
  parsed.sort((a, b) => a.year - b.year || a.race.localeCompare(b.race));
  return { parsed, rejected };
}

export function toFixtureCsv(rows: readonly InfantMortalityRow[]): string {
  return (
    ['Year,Race,RatePer1000LiveBirths', ...rows.map((r) => `${r.year},${r.race},${r.rate}`)].join(
      '\n',
    ) + '\n'
  );
}

export function parseFixtureCsv(csv: string): readonly InfantMortalityRow[] {
  const [header, ...lines] = csv.trim().split('\n');
  if (header !== 'Year,Race,RatePer1000LiveBirths') throw new Error('unexpected fixture header');
  return lines.map((line, index) => {
    const [year, race, rate] = line.split(',');
    if ((race !== 'Black' && race !== 'White') || !Number.isFinite(Number(rate))) {
      throw new Error(`fixture row ${index + 2} is malformed: ${line}`);
    }
    return { year: Number(year), race, rate: Number(rate) };
  });
}

/** Race of the child through 1979, race of the mother from 1980: the seam NCHS states. */
export function raceBasis(year: number): 'race of child' | 'race of mother' {
  return year < 1980 ? 'race of child' : 'race of mother';
}

async function refreshFixture(): Promise<void> {
  const response = await fetch(DATASET_API, {
    headers: { 'User-Agent': 'BlackStory research (contact: geraldmarondagher@gmail.com)' },
  });
  if (!response.ok) throw new Error(`dataset fetch failed: ${response.status}`);
  const { parsed, rejected } = parseDatasetRows(
    (await response.json()) as Record<string, unknown>[],
  );
  for (const line of rejected) console.warn(`rejected: ${line}`);
  writeFileSync(FIXTURE_PATH, toFixtureCsv(parsed));
  console.log(`Wrote ${parsed.length} rows to ${FIXTURE_PATH}`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--refresh-fixture')) return refreshFixture();
  const csv = readFileSync(FIXTURE_PATH, 'utf8');
  const rows = parseFixtureCsv(csv);
  const contentHash = createHash('sha256').update(csv).digest('hex');
  const apply =
    process.env.DRY_RUN === '0' && process.env.INGEST_NCHS_INFANT_MORTALITY_APPLY === '1';
  console.log(
    JSON.stringify(
      {
        apply,
        rows: rows.length,
        years: [rows[0]?.year, rows[rows.length - 1]?.year],
        byRace: {
          Black: rows.filter((r) => r.race === 'Black').length,
          White: rows.filter((r) => r.race === 'White').length,
        },
        source: DATASET_URL,
      },
      null,
      2,
    ),
  );
  if (!apply) {
    console.log('Dry run. Set DRY_RUN=0 INGEST_NCHS_INFANT_MORTALITY_APPLY=1 to write.');
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  const client = await pool.connect();
  const retrievedAt = new Date().toISOString();
  try {
    await client.query('BEGIN');
    for (const [race, metricId] of Object.entries(METRIC_IDS)) {
      await client.query(
        `INSERT INTO reference.statistical_series
           (metric_id, metric_definition, universe, unit, source_dataset, source_table,
            source_variable, geography_type, estimate_type, period_type,
            external_data_source_id, theme, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'nation','rate','annual',NULL,'health',$8::jsonb)
         ON CONFLICT (metric_id) DO UPDATE SET
           metric_definition = EXCLUDED.metric_definition, universe = EXCLUDED.universe,
           unit = EXCLUDED.unit, source_dataset = EXCLUDED.source_dataset,
           source_table = EXCLUDED.source_table, source_variable = EXCLUDED.source_variable,
           metadata = EXCLUDED.metadata, updated_at = now()`,
        [
          metricId,
          `Infant mortality rate, ${race} infants, United States`,
          'Live births, by race (race of child through 1979, race of mother from 1980)',
          'per_1000_live_births',
          'nchs-infant-mortality-by-race',
          DATASET_NAME,
          'infant_mortality_rate',
          JSON.stringify({ raceBasisNote: NCHS_RACE_BASIS_NOTE, dataset: DATASET_URL }),
        ],
      );
    }
    for (const row of rows) {
      const metricId = METRIC_IDS[row.race];
      await client.query(
        `INSERT INTO reference.statistical_observations
           (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
            estimate, margin_of_error, race_ethnicity_slice, status, source, source_url,
            retrieved_at, content_hash, metadata)
         VALUES ($1,$2,'nation:US','2020',$3,'1915-2013',$4,NULL,NULL,'observed',$5,$6,$7::timestamptz,$8,$9::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           estimate = EXCLUDED.estimate, source = EXCLUDED.source, source_url = EXCLUDED.source_url,
           content_hash = EXCLUDED.content_hash, retrieved_at = EXCLUDED.retrieved_at,
           metadata = EXCLUDED.metadata`,
        [
          `${metricId}:${row.year}:nation`,
          metricId,
          String(row.year),
          row.rate,
          DATASET_NAME,
          DATASET_URL,
          retrievedAt,
          contentHash,
          JSON.stringify({
            raceLabel: row.race,
            raceBasis: raceBasis(row.year),
            raceBasisNote: NCHS_RACE_BASIS_NOTE,
          }),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied ${rows.length} observations across ${Object.keys(METRIC_IDS).length} series.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('ingest-nchs-infant-mortality.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

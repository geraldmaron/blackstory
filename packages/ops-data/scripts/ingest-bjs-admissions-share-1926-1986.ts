/**
 * BJS admissions-by-race share ingest (1926-1986) for national observations
 * into bb_reference.statistical_observations. Creates separate metric for
 * prison admissions share (not rates, since historical counts-only data exists).
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-bjs-admissions-share-1926-1986.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_BJS_ADMISSIONS_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-bjs-admissions-share-1926-1986.ts
 *
 *   # Offline admissions share CSV
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-bjs-admissions-share-1926-1986.ts \
 *     --admissions-csv=packages/ops-data/fixtures/reference-indicators/bjs-admissions-share-black-1926-1986.csv
 *
 * Source: BJS "Race of Prisoners Admitted to State and Federal Institutions, 1926–86"
 * (Bureau of Justice Statistics). These are shares (percentages) of total admissions,
 * not rates per population.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/bjs-admissions-share-black-1926-1986.csv',
);

const BJS_HOMEPAGE = 'https://www.ojp.gov/pdffiles1/nij/125618.pdf';

// National jurisdiction ID for US
const NATION_JURISDICTION_ID = 'nation:US';

// Metric IDs for admissions share
const METRIC_ID = 'bjs-admissions-share-black-nation';

interface AdmissionsRow {
  readonly year: string;
  readonly blackShare?: number;
}

interface ObservationDraft {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly raceEthnicitySlice: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function parseFloat2(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const v = parseFloat(value.trim().replace('%', ''));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;
}

function observationId(metricId: string, referencePeriod: string): string {
  return `obs:${metricId}:${NATION_JURISDICTION_ID}:${referencePeriod}`;
}

function contentHashForObservation(
  metricId: string,
  referencePeriod: string,
  estimate: number,
): string {
  const data = JSON.stringify({
    metricId,
    referencePeriod,
    estimate,
    boundaryVersion: 'nation-2020',
  });
  return createHash('sha256').update(data).digest('hex');
}

function parseAdmissionsCsv(csvText: string): {
  readonly rows: readonly AdmissionsRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const rows: AdmissionsRow[] = [];
  const rejected: string[] = [];

  // Find header line
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.toLowerCase();
    if (line.includes('year') && line.includes('black')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      'Admissions CSV missing year/black header; expected columns like: Year,Black Share (%)',
    );
  }

  const headerLine = lines[headerIndex]!;
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const yearIdx = headers.findIndex((h) => h.includes('year'));
  const blackIdx = headers.findIndex((h) => h.includes('black'));

  if (yearIdx < 0) {
    throw new Error('Admissions CSV missing Year column');
  }

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith('#')) continue;

    const cells = line.split(',');
    const year = cells[yearIdx]?.trim();
    if (!year || !/^\d{4}$/.test(year)) {
      rejected.push(`invalid year: ${year}`);
      continue;
    }

    const blackShare = parseFloat2(cells[blackIdx]);
    if (blackShare === undefined) {
      rejected.push(`${year}: no black share data`);
      continue;
    }

    rows.push({ year, blackShare });
  }

  return { rows, rejected };
}

async function ensureSeriesDefined(databaseUrl: string): Promise<void> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });

  try {
    const result = await pool.query<{ metric_id: string }>(
      `SELECT metric_id FROM bb_reference.statistical_series WHERE metric_id = $1`,
      [METRIC_ID],
    );

    if (result.rows.length === 0) {
      // Series does not exist; create it
      await pool.query(
        `INSERT INTO bb_reference.statistical_series
          (metric_id, metric_definition, universe, unit, source_dataset, source_table,
           source_variable, geography_type, estimate_type, period_type,
           external_data_source_id, theme, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
        [
          METRIC_ID,
          'Share of prisoners admitted to state/federal institutions who are Black (non-Hispanic)',
          'prisoners admitted state/federal',
          'percent',
          'bjs-race-of-prisoners-1926-86',
          'admissions_by_race',
          'black_admissions_share',
          'nation',
          'percentage',
          'annual',
          'bjs-national-prisoner-statistics',
          'justice',
          JSON.stringify({
            raceEthnicitySlice: 'black',
            note:
              'Historical admissions share data 1926-1986. These are shares of total admissions, not population rates.',
          }),
        ],
      );
    }
  } finally {
    await pool.end();
  }
}

function buildObservations(
  rows: readonly AdmissionsRow[],
  retrievedAt: string,
): readonly ObservationDraft[] {
  const drafts: ObservationDraft[] = [];

  for (const row of rows) {
    const year = row.year;
    const yearNum = parseInt(year, 10);

    // Only 1926-1986
    if (yearNum < 1926 || yearNum > 1986) {
      continue;
    }

    if (row.blackShare !== undefined) {
      drafts.push({
        id: observationId(METRIC_ID, year),
        metricId: METRIC_ID,
        jurisdictionId: NATION_JURISDICTION_ID,
        boundaryVersion: 'nation-2020',
        referencePeriod: year,
        datasetVintage: 'BJS Race of Prisoners Admitted 1926-1986',
        estimate: row.blackShare,
        raceEthnicitySlice: 'black',
        source: 'bjs-race-of-prisoners-1926-86',
        sourceUrl: BJS_HOMEPAGE,
        retrievedAt,
        contentHash: contentHashForObservation(METRIC_ID, year, row.blackShare),
      });
    }
  }

  return drafts;
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

    for (const obs of observations) {
      await client.query(
        `INSERT INTO bb_reference.statistical_observations
          (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
           estimate, race_ethnicity_slice, status, source, source_url,
           retrieved_at, content_hash, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'observed',$9,$10,$11::timestamptz,$12,$13::jsonb)
         ON CONFLICT (metric_id, jurisdiction_id, reference_period, boundary_version, race_ethnicity_slice)
         DO UPDATE SET
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
          obs.raceEthnicitySlice,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            source_vintage: 'BJS Race of Prisoners Admitted 1926-1986',
            note: 'Percentage of total prisoners admitted that year who were Black (non-Hispanic). Not a per-capita rate.',
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
  const apply = process.env.INGEST_BJS_ADMISSIONS_APPLY === '1' && process.env.DRY_RUN !== '1';
  const admissionsCsvPath = arg('admissions-csv') ?? DEFAULT_FIXTURE;
  const retrievedAt = new Date().toISOString();

  if (!existsSync(admissionsCsvPath)) {
    throw new Error(`Admissions CSV fixture not found: ${admissionsCsvPath}`);
  }

  const csvText = readFileSync(admissionsCsvPath, 'utf8');
  const parseResult = parseAdmissionsCsv(csvText);
  const observations = buildObservations(parseResult.rows, retrievedAt);

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    sourceFixture: admissionsCsvPath,
    rowsParsed: parseResult.rows.length,
    observationsBuilt: observations.length,
    blackAdmissionsObservations: observations.filter((o) => o.raceEthnicitySlice === 'black')
      .length,
    rejectedParseRows: parseResult.rejected.length,
    sourceUrl: BJS_HOMEPAGE,
    datasetVintage: 'BJS Race of Prisoners Admitted 1926-1986',
    metricId: METRIC_ID,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_BJS_ADMISSIONS_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  await ensureSeriesDefined(databaseUrl);
  const written = await applyObservations(observations, databaseUrl);
  summary.appliedObservations = written;

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

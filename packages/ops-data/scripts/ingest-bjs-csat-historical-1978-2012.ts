/**
 * BJS CSAT historical imprisonment rate ingest (1978-2012) for national observations
 * into bb_reference.statistical_observations. Extends existing 2013-2023 series back
 * to 1978 using CSAT-Prisoners export.
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-bjs-csat-historical-1978-2012.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_BJS_CSAT_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-bjs-csat-historical-1978-2012.ts
 *
 *   # Offline CSAT export CSV
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-bjs-csat-historical-1978-2012.ts \
 *     --csat-csv=packages/ops-data/fixtures/reference-indicators/bjs-csat-national-rates-1978-2012.csv
 *
 * Source: BJS Corrections Statistical Analysis Tool (CSAT-Prisoners) export,
 * https://csat.bjs.ojp.gov — imprisonment rates per 100,000 by race/ethnicity,
 * 1978-2012 national aggregates.
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
  '../fixtures/reference-indicators/bjs-csat-national-rates-1978-2012.csv',
);

const CSAT_HOMEPAGE = 'https://bjs.ojp.gov/content/pub/pdf/p20st.pdf';
const BJS_HOMEPAGE = 'https://bjs.ojp.gov/';

// National jurisdiction ID for US
const NATION_JURISDICTION_ID = 'nation:US';

// Metric IDs matching existing series
const METRIC_IDS = {
  BLACK: 'bjs-imprisonment-rate-black-nation',
  WHITE: 'bjs-imprisonment-rate-white-nation',
  HISPANIC: 'bjs-imprisonment-rate-hispanic-nation',
} as const;

interface CsatRow {
  readonly year: string;
  readonly blackRate?: number;
  readonly whiteRate?: number;
  readonly hispanicRate?: number;
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
  const v = parseFloat(value.trim());
  return Number.isFinite(v) ? v : undefined;
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

function parseCsatCsv(csvText: string): {
  readonly rows: readonly CsatRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/);
  const rows: CsatRow[] = [];
  const rejected: string[] = [];

  // Find header line
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.toLowerCase();
    if (line.includes('year') && (line.includes('black') || line.includes('white'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      'CSAT CSV missing year header; expected columns like: Year,Black Rate,White Rate,Hispanic Rate',
    );
  }

  const headerLine = lines[headerIndex]!;
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const yearIdx = headers.findIndex((h) => h.includes('year'));
  const blackIdx = headers.findIndex((h) => h.includes('black'));
  const whiteIdx = headers.findIndex((h) => h.includes('white'));
  const hispanicIdx = headers.findIndex((h) => h.includes('hispanic'));

  if (yearIdx < 0) {
    throw new Error('CSAT CSV missing Year column');
  }

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith('#')) continue;

    const cells = line.split(',');
    const year = cells[yearIdx]?.trim();
    if (!year || !/^\d{4}$/.test(year)) {
      rejected.push(`invalid year: ${year}`);
      continue;
    }

    const blackRate = parseFloat2(cells[blackIdx]);
    const whiteRate = parseFloat2(cells[whiteIdx]);
    const hispanicRate = parseFloat2(cells[hispanicIdx]);

    if (blackRate === undefined && whiteRate === undefined && hispanicRate === undefined) {
      rejected.push(`${year}: no rate data`);
      continue;
    }

    rows.push({
      year,
      ...(blackRate !== undefined ? { blackRate } : {}),
      ...(whiteRate !== undefined ? { whiteRate } : {}),
      ...(hispanicRate !== undefined ? { hispanicRate } : {}),
    });
  }

  return { rows, rejected };
}

async function loadExistingSeriesMetadata(
  databaseUrl: string,
): Promise<Map<string, { unit: string; sourceDataset: string }>> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  try {
    const result = await pool.query<{ metric_id: string; unit: string; source_dataset: string }>(
      `SELECT metric_id, unit, source_dataset FROM bb_reference.statistical_series
       WHERE metric_id IN ($1, $2, $3)`,
      [METRIC_IDS.BLACK, METRIC_IDS.WHITE, METRIC_IDS.HISPANIC],
    );
    const metadata = new Map<string, { unit: string; sourceDataset: string }>();
    for (const row of result.rows) {
      metadata.set(row.metric_id, {
        unit: row.unit,
        sourceDataset: row.source_dataset,
      });
    }
    return metadata;
  } finally {
    await pool.end();
  }
}

function buildObservations(
  rows: readonly CsatRow[],
  retrievedAt: string,
): readonly ObservationDraft[] {
  const drafts: ObservationDraft[] = [];

  for (const row of rows) {
    const year = row.year;

    // Skip if year is outside the 1978-2012 range we're backfilling
    const yearNum = parseInt(year, 10);
    if (yearNum < 1978 || yearNum > 2012) {
      continue;
    }

    if (row.blackRate !== undefined) {
      drafts.push({
        id: observationId(METRIC_IDS.BLACK, year),
        metricId: METRIC_IDS.BLACK,
        jurisdictionId: NATION_JURISDICTION_ID,
        boundaryVersion: 'nation-2020',
        referencePeriod: year,
        datasetVintage: 'BJS Prisoners in 2020 - Statistical Tables, Table 5 (2010-2012 verified subset)',
        estimate: row.blackRate,
        raceEthnicitySlice: 'black',
        source: 'bjs-csat-prisoners',
        sourceUrl: CSAT_HOMEPAGE,
        retrievedAt,
        contentHash: contentHashForObservation(METRIC_IDS.BLACK, year, row.blackRate),
      });
    }

    if (row.whiteRate !== undefined) {
      drafts.push({
        id: observationId(METRIC_IDS.WHITE, year),
        metricId: METRIC_IDS.WHITE,
        jurisdictionId: NATION_JURISDICTION_ID,
        boundaryVersion: 'nation-2020',
        referencePeriod: year,
        datasetVintage: 'BJS Prisoners in 2020 - Statistical Tables, Table 5 (2010-2012 verified subset)',
        estimate: row.whiteRate,
        raceEthnicitySlice: 'white',
        source: 'bjs-csat-prisoners',
        sourceUrl: CSAT_HOMEPAGE,
        retrievedAt,
        contentHash: contentHashForObservation(METRIC_IDS.WHITE, year, row.whiteRate),
      });
    }

    if (row.hispanicRate !== undefined) {
      drafts.push({
        id: observationId(METRIC_IDS.HISPANIC, year),
        metricId: METRIC_IDS.HISPANIC,
        jurisdictionId: NATION_JURISDICTION_ID,
        boundaryVersion: 'nation-2020',
        referencePeriod: year,
        datasetVintage: 'BJS Prisoners in 2020 - Statistical Tables, Table 5 (2010-2012 verified subset)',
        estimate: row.hispanicRate,
        raceEthnicitySlice: 'hispanic',
        source: 'bjs-csat-prisoners',
        sourceUrl: CSAT_HOMEPAGE,
        retrievedAt,
        contentHash: contentHashForObservation(METRIC_IDS.HISPANIC, year, row.hispanicRate),
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
            source_vintage: 'CSAT-Prisoners National Rates',
            note:
              'Rates are sentenced prisoners per 100,000 US population of each race/ethnicity group (national aggregates only).',
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
  const apply = process.env.INGEST_BJS_CSAT_APPLY === '1' && process.env.DRY_RUN !== '1';
  const csatCsvPath = arg('csat-csv') ?? DEFAULT_FIXTURE;
  const retrievedAt = new Date().toISOString();

  if (!existsSync(csatCsvPath)) {
    throw new Error(`CSAT CSV fixture not found: ${csatCsvPath}`);
  }

  const csvText = readFileSync(csatCsvPath, 'utf8');
  const parseResult = parseCsatCsv(csvText);
  const observations = buildObservations(parseResult.rows, retrievedAt);

  const byMetric = new Map<string, number>();
  for (const obs of observations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    sourceFixture: csatCsvPath,
    rowsParsed: parseResult.rows.length,
    observationsBuilt: observations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejectedParseRows: parseResult.rejected.length,
    sourceUrl: CSAT_HOMEPAGE,
    bjsHomepage: BJS_HOMEPAGE,
    datasetVintage: 'BJS Prisoners in 2020 - Statistical Tables, Table 5 (2010-2012 verified subset)',
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_BJS_CSAT_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  // Verify metric series exist
  const seriesMetadata = await loadExistingSeriesMetadata(databaseUrl);
  if (seriesMetadata.size === 0) {
    throw new Error(
      'No existing imprisonment rate series found. Ensure metrics are defined before applying observations.',
    );
  }

  const written = await applyObservations(observations, databaseUrl);
  summary.appliedObservations = written;
  summary.existingMetricSeries = [...seriesMetadata.keys()];

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

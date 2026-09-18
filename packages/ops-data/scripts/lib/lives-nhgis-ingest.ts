/**
 * Shared NHGIS extract ingestion: acquire files, report derived observations, and persist
 * observations with series rows in one transaction. Downloads remain outside the repository.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';
import { getNhgisExtractStatus, submitNhgisExtract, type NhgisFetchLike } from '@repo/domain';
import type { LivesPublishedObservation } from '../../src/lives/published-observation.ts';
import { livesSeriesColumns, livesSeriesRow } from '../../src/lives/series.ts';

const POLL_MS = 20_000;
const MAX_POLLS = 135;
const BATCH = 400;

/**
 * An unzipped extract: `givenDirectory` when set, otherwise a new extract of `definition`, awaited and
 * unzipped under `cacheDir`.
 */
export async function nhgisExtractDirectory(options: {
  readonly definition: Record<string, unknown>;
  readonly apiKey: string;
  readonly cacheDir: string;
  readonly givenDirectory?: string | undefined;
}): Promise<string> {
  const given = options.givenDirectory?.trim();
  if (given) return given;
  const { apiKey, cacheDir } = options;
  const fetchImpl = fetch as unknown as NhgisFetchLike;
  const handle = await submitNhgisExtract(options.definition, { apiKey, fetchImpl });
  console.log(`Submitted NHGIS extract ${handle.number}; waiting for it to finish.`);
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const status = await getNhgisExtractStatus(handle.number, { apiKey, fetchImpl });
    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`NHGIS extract ${handle.number} ${status.status}`);
    }
    if (status.status !== 'completed' || !status.tableDataUrl) continue;
    const response = await fetch(status.tableDataUrl, { headers: { Authorization: apiKey } });
    if (!response.ok) throw new Error(`NHGIS download failed: HTTP ${response.status}`);
    const directory = path.join(cacheDir, `nhgis-extract-${handle.number}`);
    await mkdir(directory, { recursive: true });
    const zipPath = path.join(directory, 'table-data.zip');
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', directory]);
    console.log(`Downloaded extract ${handle.number} to ${directory}`);
    return directory;
  }
  throw new Error(`NHGIS extract ${handle.number} did not finish in time`);
}

/** Counts per period and metric, and every national figure except brackets, for the run report. */
export function summarizeLivesObservations(observations: readonly LivesPublishedObservation[]) {
  const byMetric = new Map<string, number>();
  for (const o of observations) {
    const metric = o.metricId.startsWith('lives-income-bracket')
      ? 'lives-income-bracket-*'
      : o.metricId;
    const key = `${o.referencePeriod} ${metric}`;
    byMetric.set(key, (byMetric.get(key) ?? 0) + 1);
  }
  const national = observations
    .filter(
      (o) => o.jurisdictionId === 'nation:US' && !o.metricId.startsWith('lives-income-bracket'),
    )
    .map(
      (o) =>
        `${o.referencePeriod} ${o.metricId} ${o.raceEthnicitySlice}: ${Math.round(o.estimate * 10) / 10}`,
    );
  return { observations: observations.length, byMetric: Object.fromEntries(byMetric), national };
}

/**
 * Series rows for every metric the observations use. Throws on a duplicate observation id, a source
 * that is not a web link, or a metric with no Lives series definition, so each surfaces in a dry run.
 */
export function livesSeriesForObservations(observations: readonly LivesPublishedObservation[]) {
  if (new Set(observations.map((o) => o.id)).size !== observations.length) {
    throw new Error('duplicate observation ids');
  }
  const unlinked = [
    ...new Set(observations.filter((o) => !/^https:\/\//.test(o.sourceUrl)).map((o) => o.source)),
  ];
  if (unlinked.length > 0) {
    throw new Error(`sources without a web link:\n${unlinked.join('\n')}`);
  }
  return [...new Set(observations.map((o) => o.metricId))].map((id) => {
    const row = livesSeriesRow(id);
    if (!row) throw new Error(`no series definition for ${id}`);
    return livesSeriesColumns(row);
  });
}

/** Throws unless every observation's jurisdiction is already in `reference.jurisdictions`. */
export async function assertLivesJurisdictions(
  pool: Pool,
  observations: readonly LivesPublishedObservation[],
): Promise<void> {
  const jurisdictionIds = [...new Set(observations.map((o) => o.jurisdictionId))];
  const known = await pool.query<{ id: string }>(
    'SELECT id FROM reference.jurisdictions WHERE id = ANY($1::text[])',
    [jurisdictionIds],
  );
  const existing = new Set(known.rows.map((row) => row.id));
  const missing = jurisdictionIds.filter((id) => !existing.has(id));
  if (missing.length > 0) throw new Error(`missing jurisdictions: ${missing.join(', ')}`);
}

/** Upserts the series rows and observations in one transaction. Returns the number of series written. */
export async function upsertLivesObservations(
  pool: Pool,
  observations: readonly LivesPublishedObservation[],
): Promise<number> {
  const series = livesSeriesForObservations(observations);
  const client = await pool.connect();
  const retrievedAt = new Date().toISOString();
  try {
    await client.query('BEGIN');
    for (const s of series) {
      await client.query(
        `INSERT INTO reference.statistical_series
          (metric_id, metric_definition, universe, unit, source_dataset, source_table, source_variable,
           geography_type, estimate_type, period_type, external_data_source_id, theme, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ON CONFLICT (metric_id) DO UPDATE SET
           metric_definition = EXCLUDED.metric_definition, universe = EXCLUDED.universe,
           unit = EXCLUDED.unit, source_dataset = EXCLUDED.source_dataset,
           source_table = EXCLUDED.source_table, source_variable = EXCLUDED.source_variable,
           geography_type = EXCLUDED.geography_type, estimate_type = EXCLUDED.estimate_type,
           period_type = EXCLUDED.period_type, theme = EXCLUDED.theme, metadata = EXCLUDED.metadata,
           updated_at = now()`,
        [
          s.metric_id,
          s.metric_definition,
          s.universe,
          s.unit,
          s.source_dataset,
          s.source_table,
          s.source_variable,
          s.geography_type,
          s.estimate_type,
          s.period_type,
          s.external_data_source_id,
          s.theme,
          JSON.stringify(s.metadata),
        ],
      );
    }
    for (let start = 0; start < observations.length; start += BATCH) {
      const batch = observations.slice(start, start + BATCH);
      const values: unknown[] = [retrievedAt];
      const tuples = batch.map((o) => {
        const first = values.length + 1;
        values.push(
          o.id,
          o.metricId,
          o.jurisdictionId,
          o.boundaryVersion,
          o.referencePeriod,
          o.datasetVintage,
          o.estimate,
          o.marginOfError,
          o.numerator,
          o.denominator,
          o.raceEthnicitySlice,
          o.source,
          o.sourceUrl,
          o.contentHash,
          JSON.stringify(o.metadata),
        );
        const p = (offset: number) => `$${first + offset}`;
        return `(${p(0)},${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},${p(6)},${p(7)},${p(8)},${p(9)},${p(10)},'observed',${p(11)},${p(12)},$1::timestamptz,${p(13)},${p(14)}::jsonb)`;
      });
      await client.query(
        `INSERT INTO reference.statistical_observations
          (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage, estimate,
           margin_of_error, numerator, denominator, race_ethnicity_slice, status, source, source_url,
           retrieved_at, content_hash, metadata)
         VALUES ${tuples.join(',')}
         ON CONFLICT (id) DO UPDATE SET
           estimate = EXCLUDED.estimate, margin_of_error = EXCLUDED.margin_of_error,
           numerator = EXCLUDED.numerator, denominator = EXCLUDED.denominator,
           dataset_vintage = EXCLUDED.dataset_vintage, source = EXCLUDED.source,
           source_url = EXCLUDED.source_url, content_hash = EXCLUDED.content_hash,
           retrieved_at = EXCLUDED.retrieved_at, metadata = EXCLUDED.metadata`,
        values,
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return series.length;
}

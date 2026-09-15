/**
 * Loads American Community Survey five-year tables by race for Lives Across the Decades (bead
 * repo-0clax.22): 2008–2012 for the 2010s and 2019–2023 for the 2020s, for every state, DC and the
 * nation. Figures keep the published counts and margins; regions are summed later by the builder.
 *
 * The Census API data endpoint needs a key, so figures come from an IPUMS NHGIS extract of the same
 * tables (NHGIS_API_KEY). Point LIVES_NHGIS_EXTRACT_DIR at an unzipped extract to reuse one; otherwise
 * the script submits the extract, waits for it and unzips it under LIVES_ACS_CACHE_DIR (default the OS
 * temp dir). Nothing downloaded is written to the repo.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/ingest-lives-acs.ts
 *   DRY_RUN=0 INGEST_LIVES_ACS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-lives-acs.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {
  assertNhgisApiKeyConfigured,
  getNhgisExtractStatus,
  submitNhgisExtract,
  type NhgisFetchLike,
} from '@repo/domain';
import {
  LIVES_ACS_VINTAGES,
  buildAcsObservations,
  livesAcsTables,
  livesNhgisDataset,
  livesNhgisExtractDefinition,
  nhgisTableToAcs,
  parseCsv,
  readNhgisTableMeta,
  type LivesAcsObservation,
  type NhgisTableMeta,
} from '../src/lives/acs.ts';
import { livesSeriesColumns, livesSeriesRow } from '../src/lives/series.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.INGEST_LIVES_ACS_APPLY === '1';
const cacheDir = process.env.LIVES_ACS_CACHE_DIR ?? path.join(tmpdir(), 'blackstory-lives-acs');
const BATCH = 400;
const POLL_MS = 20_000;
const MAX_POLLS = 135;

const fetchImpl = fetch as unknown as NhgisFetchLike;

async function cachedJson(url: string, cacheName: string, apiKey: string): Promise<unknown> {
  const cachePath = path.join(cacheDir, 'meta', cacheName);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  } catch {
    // not cached yet
  }
  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const json: unknown = await response.json();
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(json));
  return json;
}

async function extractDirectory(apiKey: string): Promise<string> {
  const given = process.env.LIVES_NHGIS_EXTRACT_DIR?.trim();
  if (given) return given;
  const handle = await submitNhgisExtract(livesNhgisExtractDefinition(), { apiKey, fetchImpl });
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

async function collect(apiKey: string): Promise<LivesAcsObservation[]> {
  const tables = livesAcsTables();
  const metaByPeriod = new Map<string, Map<string, NhgisTableMeta>>();
  for (const vintage of LIVES_ACS_VINTAGES) {
    const metas = new Map<string, NhgisTableMeta>();
    for (const table of tables) {
      const dataset = livesNhgisDataset(vintage, table);
      metas.set(
        table.group,
        readNhgisTableMeta(
          await cachedJson(
            `https://api.ipums.org/metadata/datasets/${dataset}/data_tables/${table.group}?collection=nhgis&version=2`,
            `${dataset}-${table.group}.json`,
            apiKey,
          ),
        ),
      );
    }
    metaByPeriod.set(vintage.period, metas);
  }

  const directory = await extractDirectory(apiKey);
  const files = (await readdir(directory, { recursive: true }))
    .filter((name) => name.endsWith('.csv'))
    .map((name) => path.join(directory, name));
  const observations: LivesAcsObservation[] = [];
  const loaded = new Map<string, Set<string>>();
  for (const file of files) {
    const csv = parseCsv(await readFile(file, 'utf8'));
    const header = csv[0] ?? [];
    const yearIndex = header.indexOf('YEAR');
    const period = csv.find((row, index) => index > 0 && row[0] !== 'GIS Join Match Code')?.[
      yearIndex
    ];
    const vintage = LIVES_ACS_VINTAGES.find((candidate) => candidate.period === period);
    if (!vintage) continue;
    const metas = metaByPeriod.get(vintage.period)!;
    for (const table of tables) {
      const meta = metas.get(table.group)!;
      const converted = nhgisTableToAcs(meta, csv);
      if (!converted) continue;
      const built = buildAcsObservations({
        table,
        vintage,
        labels: converted.labels,
        rows: converted.rows,
        nhgisCode: meta.nhgisCode,
      });
      observations.push(...built);
      const key = `${vintage.period} ${table.group}`;
      const seen = loaded.get(key) ?? new Set<string>();
      for (const observation of built) seen.add(observation.jurisdictionId);
      loaded.set(key, seen);
    }
  }

  const gaps: string[] = [];
  for (const vintage of LIVES_ACS_VINTAGES) {
    for (const table of tables) {
      const seen = loaded.get(`${vintage.period} ${table.group}`)?.size ?? 0;
      const expected = table.nationOnly ? 1 : 52;
      if (seen < expected)
        gaps.push(`${vintage.period} ${table.group}: ${seen} of ${expected} places`);
    }
  }
  if (gaps.length > 0) throw new Error(`extract is missing tables or places:\n${gaps.join('\n')}`);
  return observations;
}

async function main(): Promise<void> {
  const apiKey = process.env.NHGIS_API_KEY?.trim();
  assertNhgisApiKeyConfigured(apiKey);
  const observations = await collect(apiKey);
  const ids = new Set(observations.map((o) => o.id));
  if (ids.size !== observations.length) throw new Error('duplicate observation ids');

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
  console.log(
    JSON.stringify(
      {
        apply,
        observations: observations.length,
        byMetric: Object.fromEntries(byMetric),
        national,
      },
      null,
      2,
    ),
  );

  const series = [...new Set(observations.map((o) => o.metricId))].map((id) => {
    const row = livesSeriesRow(id);
    if (!row) throw new Error(`no series definition for ${id}`);
    return livesSeriesColumns(row);
  });

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (apply) throw new Error('DATABASE_URL is required to apply');
    return;
  }
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    const jurisdictionIds = [...new Set(observations.map((o) => o.jurisdictionId))];
    const known = await pool.query<{ id: string }>(
      'SELECT id FROM bb_reference.jurisdictions WHERE id = ANY($1::text[])',
      [jurisdictionIds],
    );
    const existing = new Set(known.rows.map((row) => row.id));
    const missing = jurisdictionIds.filter((id) => !existing.has(id));
    if (missing.length > 0) throw new Error(`missing jurisdictions: ${missing.join(', ')}`);
    if (!apply) {
      console.log('Dry run. Set DRY_RUN=0 INGEST_LIVES_ACS_APPLY=1 to write.');
      return;
    }

    const client = await pool.connect();
    const retrievedAt = new Date().toISOString();
    try {
      await client.query('BEGIN');
      for (const s of series) {
        await client.query(
          `INSERT INTO bb_reference.statistical_series
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
          `INSERT INTO bb_reference.statistical_observations
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
    console.log(`Upserted ${series.length} series and ${observations.length} observations.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

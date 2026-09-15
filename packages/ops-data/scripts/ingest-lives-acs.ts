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
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { assertNhgisApiKeyConfigured } from '@repo/domain';
import {
  LIVES_ACS_VINTAGES,
  buildAcsObservations,
  livesAcsTables,
  livesNhgisDataset,
  livesNhgisExtractDefinition,
  nhgisTableToAcs,
  parseCsv,
  readNhgisTableMeta,
  type NhgisTableMeta,
} from '../src/lives/acs.ts';
import type { LivesPublishedObservation } from '../src/lives/published-observation.ts';
import {
  assertLivesJurisdictions,
  livesSeriesForObservations,
  nhgisExtractDirectory,
  summarizeLivesObservations,
  upsertLivesObservations,
} from './lib/lives-nhgis-ingest.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.INGEST_LIVES_ACS_APPLY === '1';
const cacheDir = process.env.LIVES_ACS_CACHE_DIR ?? path.join(tmpdir(), 'blackstory-lives-acs');

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

async function collect(apiKey: string): Promise<LivesPublishedObservation[]> {
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

  const directory = await nhgisExtractDirectory({
    definition: livesNhgisExtractDefinition(),
    apiKey,
    cacheDir,
    givenDirectory: process.env.LIVES_NHGIS_EXTRACT_DIR,
  });
  const files = (await readdir(directory, { recursive: true }))
    .filter((name) => name.endsWith('.csv'))
    .map((name) => path.join(directory, name));
  const observations: LivesPublishedObservation[] = [];
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
  console.log(JSON.stringify({ apply, ...summarizeLivesObservations(observations) }, null, 2));
  livesSeriesForObservations(observations);

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (apply) throw new Error('DATABASE_URL is required to apply');
    return;
  }
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    await assertLivesJurisdictions(pool, observations);
    if (!apply) {
      console.log('Dry run. Set DRY_RUN=0 INGEST_LIVES_ACS_APPLY=1 to write.');
      return;
    }
    const series = await upsertLivesObservations(pool, observations);
    console.log(`Upserted ${series} series and ${observations.length} observations.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

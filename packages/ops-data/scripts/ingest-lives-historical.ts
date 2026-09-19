/**
 * Loads the published 1870 through 1970 census tables by race for Lives Across the Decades, for every
 * state and territory the census counted, DC and the nation: population shares every decade, literacy
 * and school attendance while the census asked them, farm tenancy from 1900, homeownership from 1930,
 * and 1970's urban residence, high school completion, unemployment and family income bands. Regions
 * are summed later by the builder.
 *
 * What is missing is missing from the published record, not from this script: no census before 1970
 * crossed urban residence with race, 1890 published no literacy table at all, 1940 and 1950 published
 * no attainment, unemployment or income by race, 1960 published nothing by race but the population,
 * and Hispanic origin was not asked anywhere before 1970.
 *
 * Figures come from one IPUMS NHGIS extract of the Census Bureau's published volumes (NHGIS_API_KEY).
 * Point LIVES_HISTORICAL_EXTRACT_DIR at an unzipped extract to reuse one; otherwise the script submits
 * the extract, waits for it and unzips it under LIVES_HISTORICAL_CACHE_DIR (default the OS temp dir).
 * Nothing downloaded is written to the repo.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/ingest-lives-historical.ts
 *   DRY_RUN=0 INGEST_LIVES_HISTORICAL_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-lives-historical.ts
 */
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { assertNhgisApiKeyConfigured } from '@repo/domain';
import { parseCsv } from '../src/lives/acs.ts';
import {
  buildHistoricalObservations,
  expectedHistoricalCoverage,
  historicalCoverageKey,
  livesHistoricalExtractDefinition,
  readHistoricalFileName,
} from '../src/lives/historical.ts';
import type { LivesPublishedObservation } from '../src/lives/published-observation.ts';
import {
  assertLivesJurisdictions,
  livesSeriesForObservations,
  nhgisExtractDirectory,
  summarizeLivesObservations,
  upsertLivesObservations,
} from './lib/lives-nhgis-ingest.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.INGEST_LIVES_HISTORICAL_APPLY === '1';
const cacheDir =
  process.env.LIVES_HISTORICAL_CACHE_DIR ?? path.join(tmpdir(), 'blackstory-lives-historical');

async function collect(apiKey: string): Promise<LivesPublishedObservation[]> {
  const directory = await nhgisExtractDirectory({
    definition: livesHistoricalExtractDefinition(),
    apiKey,
    cacheDir,
    givenDirectory: process.env.LIVES_HISTORICAL_EXTRACT_DIR,
  });
  const names = (await readdir(directory, { recursive: true })).filter((name) =>
    name.endsWith('.csv'),
  );
  const files = [];
  for (const name of names) {
    const described = readHistoricalFileName(name);
    if (!described) continue;
    files.push({ ...described, csv: parseCsv(await readFile(path.join(directory, name), 'utf8')) });
  }
  return buildHistoricalObservations(files);
}

/**
 * What each measure covered and what it says about the country, so a figure that is wrong on its face
 * — a Black homeownership share near 70 percent in 1930 — is visible before anything is written.
 */
function coverage(observations: readonly LivesPublishedObservation[]) {
  const places = new Map<string, Set<string>>();
  const national = new Map<string, string[]>();
  for (const observation of observations) {
    const key = historicalCoverageKey(observation);
    places.set(key, (places.get(key) ?? new Set<string>()).add(observation.jurisdictionId));
    if (observation.jurisdictionId !== 'nation:US') continue;
    const figure = `${Math.round(observation.estimate * 10) / 10}%`;
    national.set(key, [
      ...(national.get(key) ?? []),
      observation.metricId.startsWith('lives-income-bracket')
        ? `${observation.metricId.replace('lives-income-bracket-', '')}: ${figure}`
        : figure,
    ]);
  }
  const rows = expectedHistoricalCoverage().map((key) => ({
    measure: key,
    places: places.get(key)?.size ?? 0,
    national: (national.get(key) ?? ['none']).join(', '),
  }));
  const empty = rows.filter((row) => row.places === 0).map((row) => row.measure);
  if (empty.length > 0) {
    throw new Error(`measures the extract produced nothing for:\n${empty.join('\n')}`);
  }
  return rows;
}

async function main(): Promise<void> {
  const apiKey = process.env.NHGIS_API_KEY?.trim();
  assertNhgisApiKeyConfigured(apiKey);
  const observations = await collect(apiKey);
  console.log(
    JSON.stringify(
      { apply, ...summarizeLivesObservations(observations), coverage: coverage(observations) },
      null,
      2,
    ),
  );
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
      console.log('Dry run. Set DRY_RUN=0 INGEST_LIVES_HISTORICAL_APPLY=1 to write.');
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

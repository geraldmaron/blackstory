/**
 * Loads published 1980, 1990 and 2000 census tables by race for Lives Across the Decades (bead
 * repo-0clax.23), for every state, DC and the nation: population and urban shares, homeownership, high
 * school completion, unemployment, income brackets and the national median of each decade's income
 * unit. Regions are summed later by the builder.
 *
 * Figures come from one IPUMS NHGIS extract of the Census Bureau's summary files (NHGIS_API_KEY). Point
 * LIVES_DECENNIAL_EXTRACT_DIR at an unzipped extract to reuse one; otherwise the script submits the
 * extract, waits for it and unzips it under LIVES_DECENNIAL_CACHE_DIR (default the OS temp dir).
 * Nothing downloaded is written to the repo.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/ingest-lives-decennial.ts
 *   DRY_RUN=0 INGEST_LIVES_DECENNIAL_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-lives-decennial.ts
 */
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { assertNhgisApiKeyConfigured } from '@repo/domain';
import { parseCsv } from '../src/lives/acs.ts';
import {
  buildDecennialObservations,
  decennialCoverageKey,
  expectedDecennialCoverage,
  livesDecennialExtractDefinition,
  readDecennialFileName,
} from '../src/lives/decennial.ts';
import type { LivesPublishedObservation } from '../src/lives/published-observation.ts';
import {
  assertLivesJurisdictions,
  livesSeriesForObservations,
  nhgisExtractDirectory,
  summarizeLivesObservations,
  upsertLivesObservations,
} from './lib/lives-nhgis-ingest.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.INGEST_LIVES_DECENNIAL_APPLY === '1';
const cacheDir =
  process.env.LIVES_DECENNIAL_CACHE_DIR ?? path.join(tmpdir(), 'blackstory-lives-decennial');

async function collect(apiKey: string): Promise<LivesPublishedObservation[]> {
  const directory = await nhgisExtractDirectory({
    definition: livesDecennialExtractDefinition(),
    apiKey,
    cacheDir,
    givenDirectory: process.env.LIVES_DECENNIAL_EXTRACT_DIR,
  });
  const names = (await readdir(directory, { recursive: true })).filter((name) =>
    name.endsWith('.csv'),
  );
  const observations: LivesPublishedObservation[] = [];
  for (const name of names) {
    const described = readDecennialFileName(name);
    if (!described) continue;
    const csv = parseCsv(await readFile(path.join(directory, name), 'utf8'));
    observations.push(...buildDecennialObservations({ ...described, csv }));
  }

  const seen = new Map<string, Set<string>>();
  for (const observation of observations) {
    const key = decennialCoverageKey(observation);
    const places = seen.get(key) ?? new Set<string>();
    places.add(observation.jurisdictionId);
    seen.set(key, places);
  }
  const gaps = expectedDecennialCoverage()
    .filter(({ key, places }) => (seen.get(key)?.size ?? 0) < places)
    .map(({ key, places }) => `${key}: ${seen.get(key)?.size ?? 0} of ${places} places`);
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
      console.log('Dry run. Set DRY_RUN=0 INGEST_LIVES_DECENNIAL_APPLY=1 to write.');
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

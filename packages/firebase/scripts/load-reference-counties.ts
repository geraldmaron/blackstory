/**
 * Upsert US county jurisdiction rows into bb_reference.jurisdictions from the Census
 * Bureau national county Gazetteer file (public domain). Polygons are optional for this
 * pass — id hierarchy is the priority for statistical_observations FK joins.
 *
 * Usage (repo root):
 *   # Dry-run (default): download Gazetteer, print counts + provenance
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/load-reference-counties.ts
 *
 *   # Dry-run with a local Gazetteer file (no network)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/load-reference-counties.ts \
 *     --gazetteer-file=/path/to/2024_Gaz_counties_national.txt
 *
 *   # Apply (requires states/nation seeded first via load-reference-jurisdictions.ts)
 *   DRY_RUN=0 LOAD_JURISDICTIONS_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/load-reference-counties.ts
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPublishedStatisticProvenance } from '@repo/domain';
import pg from 'pg';
import { parseGazetteerCountyFile } from '../src/jurisdictions/tiger-gazetteer.js';
import { normalizePgConnectionString } from './lib/pg-connection.js';
import {
  buildReferenceCountySeeds,
  type ReferenceCountySeed,
} from './lib/reference-county-seeds.js';

export const CENSUS_COUNTY_GAZETTEER_URL =
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip';

export const CENSUS_COUNTY_GAZETTEER_SOURCE = 'census-gazetteer-counties';
export const CENSUS_COUNTY_GAZETTEER_VERSION = '2024';

const USER_AGENT = 'BlackStoryReferenceLoader/1.0 (+https://blackstory.app)';

export type GazetteerProvenance = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

export type LoadReferenceCountiesPlan = {
  readonly dryRun: boolean;
  readonly countyCount: number;
  readonly outOfScopeCount: number;
  readonly rejectedRowCount: number;
  readonly provenance: GazetteerProvenance;
  readonly sampleIds: readonly string[];
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function fetchGazetteerCountyFileText(
  sourceUrl: string = CENSUS_COUNTY_GAZETTEER_URL,
): Promise<{ readonly text: string; readonly bytes: Buffer; readonly sourceUrl: string }> {
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Gazetteer download failed (${response.status}) from ${sourceUrl}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const tempDir = mkdtempSync(join(tmpdir(), 'blackstory-gaz-'));
  try {
    const zipPath = join(tempDir, 'counties.zip');
    writeFileSync(zipPath, bytes);
    const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim();
    const entryName = listing.split('\n').find((name) => name.endsWith('.txt'));
    if (!entryName) {
      throw new Error('Gazetteer zip did not contain a .txt county file');
    }
    const text = execFileSync('unzip', ['-p', zipPath, entryName], { encoding: 'utf8' });
    return { text, bytes, sourceUrl };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function loadGazetteerCountyFileTextFromPath(path: string): {
  readonly text: string;
  readonly bytes: Buffer;
} {
  const bytes = readFileSync(path);
  return { text: bytes.toString('utf8'), bytes };
}

export function buildLoadReferenceCountiesPlan(input: {
  readonly gazetteerText: string;
  readonly contentHash: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly dryRun: boolean;
}): LoadReferenceCountiesPlan {
  const parsed = parseGazetteerCountyFile(input.gazetteerText);
  const { seeds, outOfScope } = buildReferenceCountySeeds(parsed.rows);
  const provenance: GazetteerProvenance = {
    source: CENSUS_COUNTY_GAZETTEER_SOURCE,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    contentHash: input.contentHash,
  };
  assertPublishedStatisticProvenance(provenance);

  return {
    dryRun: input.dryRun,
    countyCount: seeds.length,
    outOfScopeCount: outOfScope.length,
    rejectedRowCount: parsed.rejected.length,
    provenance,
    sampleIds: seeds.slice(0, 5).map((seed) => seed.id),
  };
}

function buildCountyMetadata(
  seed: ReferenceCountySeed,
  provenance: GazetteerProvenance,
): Record<string, unknown> {
  return {
    seededBy: 'load-reference-counties',
    source: provenance.source,
    sourceUrl: provenance.sourceUrl,
    retrievedAt: provenance.retrievedAt,
    contentHash: provenance.contentHash,
    sourceVersion: CENSUS_COUNTY_GAZETTEER_VERSION,
    geoid: `${seed.stateFips}${seed.countyFips}`,
  };
}

async function upsertCounties(
  seeds: readonly ReferenceCountySeed[],
  provenance: GazetteerProvenance,
  databaseUrl: string,
): Promise<number> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  const batchSize = 250;
  try {
    await client.query('BEGIN');
    for (let offset = 0; offset < seeds.length; offset += batchSize) {
      const batch = seeds.slice(offset, offset + batchSize);
      const ids: string[] = [];
      const kinds: string[] = [];
      const names: string[] = [];
      const stateFips: string[] = [];
      const countyFips: string[] = [];
      const parentIds: string[] = [];
      const metadata: string[] = [];
      for (const seed of batch) {
        ids.push(seed.id);
        kinds.push(seed.kind);
        names.push(seed.name);
        stateFips.push(seed.stateFips);
        countyFips.push(seed.countyFips);
        parentIds.push(seed.parentId);
        metadata.push(JSON.stringify(buildCountyMetadata(seed, provenance)));
      }
      await client.query(
        `INSERT INTO bb_reference.jurisdictions
          (id, kind, name, state_fips, county_fips, parent_id, metadata)
         SELECT *
         FROM unnest(
           $1::text[],
           $2::text[],
           $3::text[],
           $4::text[],
           $5::text[],
           $6::text[],
           $7::jsonb[]
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           state_fips = EXCLUDED.state_fips,
           county_fips = EXCLUDED.county_fips,
           parent_id = EXCLUDED.parent_id,
           metadata = EXCLUDED.metadata,
           updated_at = now()`,
        [ids, kinds, names, stateFips, countyFips, parentIds, metadata],
      );
    }
    const verify = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM bb_reference.jurisdictions WHERE kind = 'county'`,
    );
    const countyCount = Number(verify.rows[0]?.count ?? '0');
    if (countyCount < 3000) {
      throw new Error(`Expected at least 3000 county rows after apply; found ${countyCount}`);
    }
    await client.query('COMMIT');
    return countyCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const apply = process.env.LOAD_JURISDICTIONS_APPLY === '1' && process.env.DRY_RUN !== '1';
  const retrievedAt = new Date().toISOString();
  const localFile = arg('gazetteer-file') ?? process.env.GAZETTEER_FILE?.trim();

  let gazetteerText: string;
  let contentHash: string;
  let sourceUrl: string;

  if (localFile) {
    const loaded = loadGazetteerCountyFileTextFromPath(localFile);
    gazetteerText = loaded.text;
    contentHash = sha256Hex(loaded.bytes);
    sourceUrl = `file://${localFile}`;
  } else {
    const downloaded = await fetchGazetteerCountyFileText(
      arg('gazetteer-url') ?? CENSUS_COUNTY_GAZETTEER_URL,
    );
    gazetteerText = downloaded.text;
    contentHash = sha256Hex(downloaded.bytes);
    sourceUrl = downloaded.sourceUrl;
  }

  const plan = buildLoadReferenceCountiesPlan({
    gazetteerText,
    contentHash,
    sourceUrl,
    retrievedAt,
    dryRun: !apply,
  });

  const parsed = parseGazetteerCountyFile(gazetteerText);
  const { seeds } = buildReferenceCountySeeds(parsed.rows);

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...plan,
        contentHash,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      'Dry-run only. Set LOAD_JURISDICTIONS_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert counties.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL required for apply mode');

  const countyCount = await upsertCounties(seeds, plan.provenance, databaseUrl);
  console.log(`Upserted ${seeds.length} county jurisdictions; verified ${countyCount} county rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

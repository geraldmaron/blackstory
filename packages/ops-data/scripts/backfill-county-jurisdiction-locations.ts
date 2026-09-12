/**
 * One-time backfill: populates `bb_reference.jurisdictions.location` for county rows loaded
 * before load-reference-counties.ts started writing that column (see that file's
 * upsertCountyBatch; location was NULL for all 3,144 existing county rows).
 *
 * Re-derives each row's bbox envelope from the same Census Gazetteer file the loader itself
 * uses, matched purely by the row's own GEOID (state_fips || county_fips already stored on the
 * row) — no re-scrape of a new source, no invented coordinates. See
 * packages/ops-data/scripts/lib/county-location-backfill.ts for the plan/apply logic this
 * script drives.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 BACKFILL_COUNTY_LOCATIONS_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-county-jurisdiction-locations.ts
 *
 *   # Or against a local Gazetteer file (no network):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-county-jurisdiction-locations.ts \
 *     --gazetteer-file=/path/to/2024_Gaz_counties_national.txt
 */
import pg from 'pg';
import { parseGazetteerCountyFile } from '../src/jurisdictions/tiger-gazetteer.ts';
import {
  applyCountyLocationBackfill,
  buildGazetteerBBoxIndex,
  planCountyLocationBackfill,
} from './lib/county-location-backfill.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  CENSUS_COUNTY_GAZETTEER_URL,
  fetchGazetteerCountyFileText,
  loadGazetteerCountyFileTextFromPath,
} from './load-reference-counties.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_COUNTY_LOCATIONS_APPLY === '1';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const localFile = arg('gazetteer-file') ?? process.env.GAZETTEER_FILE?.trim();
  const gazetteerText = localFile
    ? loadGazetteerCountyFileTextFromPath(localFile).text
    : (await fetchGazetteerCountyFileText(arg('gazetteer-url') ?? CENSUS_COUNTY_GAZETTEER_URL))
        .text;

  const parsed = parseGazetteerCountyFile(gazetteerText);
  console.log(
    `Gazetteer counties parsed: ${parsed.rows.length} (rejected: ${parsed.rejected.length})`,
  );
  const bboxIndex = buildGazetteerBBoxIndex(parsed.rows);

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await pool.connect();
  try {
    const plan = await planCountyLocationBackfill(client, bboxIndex);
    console.log(
      `County rows missing location: ${plan.matched.length + plan.unmatched.length} ` +
        `(matched to a Gazetteer bbox: ${plan.matched.length}, unmatched: ${plan.unmatched.length})`,
    );
    if (plan.unmatched.length > 0) {
      console.log('Unmatched sample (GEOID not found in this Gazetteer file):');
      console.table(plan.unmatched.slice(0, 10));
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        'DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 ' +
          'BACKFILL_COUNTY_LOCATIONS_APPLY=1 DATABASE_URL=… to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      const applied = await applyCountyLocationBackfill(client, plan.matched);
      await client.query('COMMIT');
      console.log(`Applied: set location on ${applied} county row(s).`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

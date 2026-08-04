/**
 * Lane B / repo-bmmo — county-centroid location fallback for NRHP Black
 * heritage rows that NPS's own ArcGIS points layer (cultural_resources/
 * nrhp_locations) does not cover.
 *
 * scrape-nrhp-black-heritage-roster.ts joins listings to lat/lng strictly by
 * NRIS_Refnum against that ArcGIS layer; 988 of 2582 rows found no match
 * there (verified: the refnums are genuinely absent from that service, not a
 * join bug — spot-checked directly against the layer). 62 of those are
 * NPS-flagged restrictedAddress (archaeological/burial sites where NPS
 * deliberately withholds the precise location); the remaining 926 are
 * ordinary listings the mapped layer simply hasn't geocoded.
 *
 * This does NOT invent site-level coordinates. It looks up the county
 * centroid from the Census Bureau's own county Gazetteer file (the same
 * public-domain source and parser already used for bb_reference.jurisdictions
 * — see src/jurisdictions/tiger-gazetteer.ts) by the row's own County+State
 * fields (already present in the NPS dataset, not guessed), and publishes at
 * `locationPrecision: 'county'` — a first-class precision tier the app's
 * redaction policy (packages/security/src/redaction.ts PRECISION_RANK) and
 * map display layer (apps/web/src/lib/map-experience/geo-precision.ts,
 * `county` -> GeoPrecisionTier 'county') already support: the entity renders
 * with a genuine county-radius affordance circle, not a misleading exact
 * pin. County precision is coarser than the City value NPS already publishes
 * in the same public dataset, so restrictedAddress rows are not exposed
 * beyond what NPS itself discloses.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 NRHP_COUNTY_RECONCILE_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/reconcile-nrhp-county-locations.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  parseGazetteerCountyFile,
  type GazetteerCountyRow,
} from '../src/jurisdictions/tiger-gazetteer.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  CENSUS_COUNTY_GAZETTEER_URL,
  fetchGazetteerCountyFileText,
  loadGazetteerCountyFileTextFromPath,
} from './load-reference-counties.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CACHE_DIR = join(REPO_ROOT, '.cache/landscape-intake');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.NRHP_COUNTY_RECONCILE_APPLY === '1';
const LANE = 'nrhp-black-heritage';
const GEOCODE_METHOD = 'census-gazetteer-county-centroid';

const US_STATE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

/** Case-insensitive lookup: the NPS dataset's own title-caser capitalizes "Of" ("District Of Columbia"). */
function stateAbbreviation(state: string): string | undefined {
  const lower = state.toLowerCase();
  const entry = Object.entries(US_STATE_ABBREVIATIONS).find(
    ([name]) => name.toLowerCase() === lower,
  );
  return entry?.[1];
}

/**
 * Pure — "St. Joseph County" / "Miami-Dade" / "Baltimore (Independent City)" /
 * "Norfolk city" (the Census Gazetteer's own suffix for Virginia/Maryland/
 * Missouri/Nevada independent cities, which are county-equivalents with no
 * separate county) -> comparable key.
 */
export function normalizeCountyName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/\(independent city\)/gu, '')
    .replace(/\b(county|parish|borough|census area|municipality|municipio|city)\b/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

/** Pure — collapses all whitespace, for a fallback match against spacing variants like "De Kalb" / "DeKalb". */
function normalizeCountyNameCompact(raw: string): string {
  return normalizeCountyName(raw).replace(/\s+/gu, '');
}

export function buildCountyCentroidIndex(rows: readonly GazetteerCountyRow[]): {
  readonly byKey: Map<string, GazetteerCountyRow>;
  readonly byCompactKey: Map<string, GazetteerCountyRow>;
} {
  const byKey = new Map<string, GazetteerCountyRow>();
  const byCompactKey = new Map<string, GazetteerCountyRow>();
  for (const row of rows) {
    byKey.set(`${row.usps}|${normalizeCountyName(row.name)}`, row);
    byCompactKey.set(`${row.usps}|${normalizeCountyNameCompact(row.name)}`, row);
  }
  return { byKey, byCompactKey };
}

type Row = {
  readonly id: string;
  readonly payload: { readonly state?: string; readonly county?: string };
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const localGazetteer = join(CACHE_DIR, '2024_Gaz_counties_national.txt');
  mkdirSync(CACHE_DIR, { recursive: true });
  let gazetteerText: string;
  try {
    gazetteerText = loadGazetteerCountyFileTextFromPath(localGazetteer).text;
    console.log(`Using cached ${localGazetteer}`);
  } catch {
    console.log(`Downloading ${CENSUS_COUNTY_GAZETTEER_URL}`);
    const fetched = await fetchGazetteerCountyFileText();
    gazetteerText = fetched.text;
    writeFileSync(localGazetteer, fetched.text);
  }

  const parsed = parseGazetteerCountyFile(gazetteerText);
  console.log(
    `Gazetteer counties parsed: ${parsed.rows.length} (rejected: ${parsed.rejected.length})`,
  );
  const { byKey, byCompactKey } = buildCountyCentroidIndex(parsed.rows);

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const res = await pool.query<Row>(
    `SELECT id, payload FROM bb_research.landscape_candidates
     WHERE lane = $1 AND (lat IS NULL OR lng IS NULL)
     ORDER BY id`,
    [LANE],
  );
  console.log(`Rows missing coordinates (lane='${LANE}'): ${res.rows.length}`);

  const matched: {
    id: string;
    lat: number;
    lng: number;
    countyGeoid: string;
    countyName: string;
  }[] = [];
  const unmatched: { id: string; state: string | undefined; county: string | undefined }[] = [];
  for (const row of res.rows) {
    const state = row.payload.state;
    const county = row.payload.county;
    const usps = state ? stateAbbreviation(state) : undefined;
    const key = usps && county ? `${usps}|${normalizeCountyName(county)}` : undefined;
    const compactKey = usps && county ? `${usps}|${normalizeCountyNameCompact(county)}` : undefined;
    const hit =
      (key ? byKey.get(key) : undefined) ?? (compactKey ? byCompactKey.get(compactKey) : undefined);
    if (hit) {
      matched.push({
        id: row.id,
        lat: hit.intptlat,
        lng: hit.intptlong,
        countyGeoid: hit.geoid,
        countyName: hit.name,
      });
    } else {
      unmatched.push({ id: row.id, state, county });
    }
  }

  console.log(`Matched to a county centroid: ${matched.length}. Unmatched: ${unmatched.length}.`);
  console.log('\nSample matches:');
  console.table(matched.slice(0, 5));
  if (unmatched.length > 0) {
    console.log(
      '\nUnmatched sample (state/county spelling likely diverges from Census Gazetteer NAME):',
    );
    console.table(unmatched.slice(0, 10));
  }

  const generatedAt = new Date().toISOString();
  const reportPath = join(
    CACHE_DIR,
    `nrhp-county-reconcile-${generatedAt.replace(/[:.]/gu, '-')}.json`,
  );
  writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt, dryRun: DRY_RUN || !APPLY, matched, unmatched }, null, 2),
  );
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 NRHP_COUNTY_RECONCILE_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of matched) {
      await client.query(
        `UPDATE bb_research.landscape_candidates
         SET lat = $1, lng = $2,
             payload = jsonb_set(payload, '{geocode}', $3::jsonb, true),
             updated_at = now()
         WHERE id = $4`,
        [
          m.lat,
          m.lng,
          JSON.stringify({
            method: GEOCODE_METHOD,
            precision: 'county',
            sourceUrl: CENSUS_COUNTY_GAZETTEER_URL,
            countyGeoid: m.countyGeoid,
            countyName: m.countyName,
          }),
          m.id,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: set county-centroid lat/lng + payload.geocode on ${matched.length} row(s).`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

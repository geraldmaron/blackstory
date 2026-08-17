/**
 * Corrects entity coordinates that were geocoded onto the wrong place of the same name.
 *
 * THE BUG CLASS. A place-name geocode with no state constraint resolves to whichever match the
 * service ranked first. Isaiah T. Montgomery, whose every published word says Mound Bayou,
 * Mississippi, carried 34.12513056, -84.80766389 — Cartersville, GEORGIA, about 500 miles away.
 * The record page's map was 112x84 and almost entirely chrome, so nobody could see where it was
 * pointing; the static locator that replaced it made it obvious in one glance.
 *
 * WHY A TABLE AND NOT A SWEEP. A coordinate is a published factual claim about a person or place,
 * so each correction names the record, the place its own text says it belongs to, and the reason.
 * Nothing here is inferred at runtime: the script's only lookup is the state's Census Gazetteer
 * place file, and its only decision is "does this entity's stored point match the Census centroid
 * for the place this table names". A row whose stored point is already right is reported and
 * skipped rather than rewritten.
 *
 * SOURCE. U.S. Census Bureau 2024 Gazetteer place files (public domain), the same publisher and
 * the same release already used for `bb_reference.jurisdictions` via
 * `src/jurisdictions/tiger-gazetteer.ts`. The published value is the Census internal point
 * (INTPTLAT/INTPTLONG) for the incorporated place — a town centroid, which is exactly the
 * `precision: 'town'` these rows already declare. This does not sharpen any record.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 PLACE_CENTROID_FIX_APPLY=1
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-place-centroid-locations.ts
 */
import pg from 'pg';
import { encodeGeohash, geohashPrefixes } from '@repo/domain/geography/geohash';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.PLACE_CENTROID_FIX_APPLY === '1';

/** Geohash character precision the affected rows already store. */
const GEOHASH_PRECISION = 5;

const GAZETTEER_URL = (stateFips: string) =>
  `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_${stateFips}.txt`;

type Correction = {
  readonly entityId: string;
  /** Exactly as the Census NAME column spells it, including the LSAD word ("city", "town"). */
  readonly censusPlaceName: string;
  readonly stateFips: string;
  readonly stateName: string;
  /** Why the stored point is wrong, in one sentence, for the audit trail. */
  readonly reason: string;
};

const CORRECTIONS: readonly Correction[] = [
  {
    entityId: 'recon_isaiah_t_montgomery',
    censusPlaceName: 'Mound Bayou city',
    stateFips: '28',
    stateName: 'Mississippi',
    reason:
      'Stored point was 34.12513056,-84.80766389 (Cartersville, Georgia) on a record whose ' +
      'location label, summary and history all name Mound Bayou, Mississippi. Same-name geocode ' +
      'collision, not a disputed location.',
  },
];

type GazetteerPlace = {
  readonly name: string;
  readonly geoid: string;
  readonly lat: number;
  readonly lng: number;
};

async function fetchPlaces(stateFips: string): Promise<GazetteerPlace[]> {
  const url = GAZETTEER_URL(stateFips);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Gazetteer fetch failed for ${stateFips}: ${response.status}`);
  const text = await response.text();
  const [header, ...lines] = text.trim().split('\n');
  const columns = (header ?? '').split('\t').map((c) => c.trim());
  const nameAt = columns.indexOf('NAME');
  const geoidAt = columns.indexOf('GEOID');
  const latAt = columns.indexOf('INTPTLAT');
  const lngAt = columns.indexOf('INTPTLONG');
  if (nameAt < 0 || geoidAt < 0 || latAt < 0 || lngAt < 0) {
    throw new Error(`Unexpected Gazetteer header for ${stateFips}: ${header}`);
  }
  return lines.map((line) => {
    const cells = line.split('\t');
    return {
      name: (cells[nameAt] ?? '').trim(),
      geoid: (cells[geoidAt] ?? '').trim(),
      lat: Number((cells[latAt] ?? '').trim()),
      lng: Number((cells[lngAt] ?? '').trim()),
    };
  });
}

/** Metres between two points, for reporting how far off the stored value was. */
function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const client = new pg.Client(normalizePgConnectionString(connectionString, process.env));
  await client.connect();

  const placesByState = new Map<string, GazetteerPlace[]>();
  let applied = 0;
  let skipped = 0;

  try {
    for (const fix of CORRECTIONS) {
      if (!placesByState.has(fix.stateFips)) {
        placesByState.set(fix.stateFips, await fetchPlaces(fix.stateFips));
      }
      const place = placesByState
        .get(fix.stateFips)!
        .find((p) => p.name.toLowerCase() === fix.censusPlaceName.toLowerCase());
      if (!place) {
        throw new Error(
          `${fix.entityId}: no Census place named "${fix.censusPlaceName}" in state ${fix.stateFips}`,
        );
      }

      const current = await client.query<{ id: string; lat: number; lng: number; label: string }>(
        `SELECT id, lat, lng, label FROM bb_canonical.entity_locations WHERE entity_id = $1`,
        [fix.entityId],
      );
      if (current.rowCount === 0) {
        console.log(`SKIP ${fix.entityId}: no canonical location row`);
        skipped += 1;
        continue;
      }

      const geohash = encodeGeohash(place.lat, place.lng, GEOHASH_PRECISION);
      const prefixes = geohashPrefixes(geohash);

      for (const row of current.rows) {
        const drift = metresBetween(
          { lat: Number(row.lat), lng: Number(row.lng) },
          { lat: place.lat, lng: place.lng },
        );
        // Already inside the place it names: leave it alone. Rewriting a correct site-level
        // point to a town centroid would be a coarsening, not a correction.
        if (drift < 5_000) {
          console.log(`SKIP ${fix.entityId} (${row.id}): already within ${Math.round(drift)}m`);
          skipped += 1;
          continue;
        }

        console.log(
          [
            `FIX  ${fix.entityId} (${row.id})`,
            `  label   ${row.label}`,
            `  from    ${row.lat}, ${row.lng}`,
            `  to      ${place.lat}, ${place.lng}  (Census ${place.name}, ${fix.stateName}, GEOID ${place.geoid})`,
            `  drift   ${Math.round(drift / 1000)} km`,
            `  geohash ${geohash}`,
            `  why     ${fix.reason}`,
          ].join('\n'),
        );

        if (DRY_RUN || !APPLY) {
          skipped += 1;
          continue;
        }

        await client.query('BEGIN');
        try {
          await client.query(
            `UPDATE bb_canonical.entity_locations
                SET lat = $2, lng = $3, geohash = $4, geohash_prefixes = $5,
                    match_method = 'census-gazetteer-place-centroid', updated_at = now()
              WHERE id = $1`,
            [row.id, place.lat, place.lng, geohash, prefixes],
          );
          // The published release carries its own copy: the site reads bb_public, so a canonical
          // fix alone would leave the wrong pin live until the next full republish.
          await client.query(
            `UPDATE bb_public.release_entities
                SET lat = $2, lng = $3,
                    location = jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(location, '{lat}', to_jsonb($2::double precision)),
                          '{lng}', to_jsonb($3::double precision)),
                        '{geohash}', to_jsonb($4::text)),
                      '{geohashPrefixes}', to_jsonb($5::text[]))
              WHERE entity_id = $1
                AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
            [fix.entityId, place.lat, place.lng, geohash, prefixes],
          );
          await client.query('COMMIT');
          applied += 1;
          console.log(`  APPLIED`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `\n${DRY_RUN || !APPLY ? 'DRY RUN — ' : ''}applied ${applied}, skipped ${skipped}, of ${CORRECTIONS.length} correction(s)`,
  );
  if (DRY_RUN || !APPLY) {
    console.log('Set DRY_RUN=0 PLACE_CENTROID_FIX_APPLY=1 to write.');
  }
}

await main();

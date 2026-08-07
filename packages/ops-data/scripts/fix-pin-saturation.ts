/**
 * repo-x8j6 — repoint people who were pinned at the institution that honors or buried them,
 * and lint the whole catalog for the same shape.
 *
 * repo-9ki8 found Harriet Tubman pinned at her visitor center. The same shape turned out to be
 * everywhere: 31 people on the Baseball Hall of Fame's coordinate in Cooperstown, 11 members of
 * Congress on the US Capitol, 10 military figures on Arlington National Cemetery. Nobody was born
 * in a hall of fame. On a catalog whose tagline is "History, pinned to place," the Atlas was
 * saying 31 Black baseball figures are from upstate New York.
 *
 * Retro fix: repoint each person to their documented birthplace, resolved through the existing
 * local city-centroid lookup (packages/domain/src/geocode/city-centroid.ts) — no new geocoding
 * dependency, no network call. Precision becomes `city`, which is what a city centroid actually
 * supports; the old `site`/`institution` asserted a building.
 *
 * Where no birthplace could be sourced, the pin is REMOVED rather than left on the honoring
 * institution. A missing pin is honest; a wrong one is not. Non-US birthplaces are also cleared
 * here — the centroid dataset is US-only, and inventing coordinates for Cárdenas or Matanzas
 * would repeat the mistake this script exists to fix. Those are tracked for a follow-up pass.
 *
 * Go-forward fix: ./lib/pin-saturation-linter.ts runs over the whole catalog on every invocation
 * and fails when people stack on an exact coordinate. Genuine co-location (the nine people
 * murdered at Emanuel AME) is exempted by coordinate, with a written reason.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/fix-pin-saturation.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_PIN_SATURATION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-pin-saturation.ts
 *
 * After applying, rebuild the release graph if adjacency/geo views depend on it.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { lookupUsCityCentroid } from '@repo/domain';
import { encodeGeohash, geohashPrefixes } from '@repo/domain/geography/geohash';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { lintPinSaturation, pinSaturationFailureMessage } from './lib/pin-saturation-linter.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_PIN_SATURATION_APPLY === '1';
const BIRTHPLACE_INPUT = process.env.BIRTHPLACE_INPUT ?? '';

/** Existing rows in this catalog carry 5-character geohashes; match that, do not introduce a second convention. */
const CATALOG_GEOHASH_LENGTH = 5;

type Birthplace = {
  readonly id: string;
  readonly display_name: string;
  readonly birth_city: string | null;
  readonly birth_state: string | null;
  readonly birth_country: string | null;
  readonly citationHref?: string;
  readonly citationLabel?: string;
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function auditPinSaturation(client: pg.Client, label: string): Promise<void> {
  const { rows } = await client.query<{
    entity_id: string;
    kind: string;
    lat: number | null;
    lng: number | null;
    precision: string | null;
  }>(
    `SELECT entity_id, kind, lat, lng, location ->> 'precision' AS precision
     FROM bb_public.release_entities
     WHERE release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
  );
  const report = lintPinSaturation(rows.map((row) => ({ ...row, entityId: row.entity_id })));
  console.log(`\n=== Pin saturation (${label}) ===`);
  if (report.findings.length === 0) {
    console.log('  no stacked person pins');
    return;
  }
  for (const finding of report.findings) {
    console.log(
      `  [${finding.severity}] ${finding.lat}, ${finding.lng} — ${finding.entityIds.length} people`,
    );
  }
  if (report.hasErrors) console.log(pinSaturationFailureMessage(report));
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== repo-x8j6 pin saturation ===');
    await auditPinSaturation(client, 'before');

    if (!BIRTHPLACE_INPUT) {
      console.log('\nNo BIRTHPLACE_INPUT supplied — audit only, nothing to repoint.');
      return;
    }

    const birthplaces: Birthplace[] = JSON.parse(readFileSync(BIRTHPLACE_INPUT, 'utf8'));

    const resolved: {
      id: string;
      name: string;
      lat: number;
      lng: number;
      geohash: string;
      city: string;
      state: string;
    }[] = [];
    const clearPin: { id: string; name: string; why: string }[] = [];

    for (const entry of birthplaces) {
      if (!entry.birth_city) {
        clearPin.push({ id: entry.id, name: entry.display_name, why: 'no birthplace sourced' });
        continue;
      }
      if (!entry.birth_state || (entry.birth_country && entry.birth_country !== 'US')) {
        clearPin.push({
          id: entry.id,
          name: entry.display_name,
          why: `non-US birthplace (${entry.birth_city}, ${entry.birth_country ?? '?'}) — city-centroid dataset is US-only`,
        });
        continue;
      }
      const centroid = lookupUsCityCentroid(entry.birth_city, entry.birth_state);
      if (!centroid) {
        clearPin.push({
          id: entry.id,
          name: entry.display_name,
          why: `city centroid lookup missed "${entry.birth_city}, ${entry.birth_state}"`,
        });
        continue;
      }
      resolved.push({
        id: entry.id,
        name: entry.display_name,
        lat: centroid.lat,
        lng: centroid.lng,
        geohash: encodeGeohash(centroid.lat, centroid.lng, CATALOG_GEOHASH_LENGTH),
        city: entry.birth_city,
        state: entry.birth_state,
      });
    }

    console.log(`\nRepoint to documented birthplace: ${resolved.length}`);
    for (const entry of resolved.slice(0, 60)) {
      console.log(
        `  ${entry.name} -> ${entry.city}, ${entry.state} (${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)})`,
      );
    }
    console.log(`\nClear pin (honest blank beats a wrong pin): ${clearPin.length}`);
    for (const entry of clearPin) console.log(`  ${entry.name} — ${entry.why}`);

    // A repoint that lands everyone on one city would just move the pile, not fix it.
    const byCoordinate = new Map<string, number>();
    for (const entry of resolved) {
      const key = `${entry.lat.toFixed(4)},${entry.lng.toFixed(4)}`;
      byCoordinate.set(key, (byCoordinate.get(key) ?? 0) + 1);
    }
    const stillStacked = [...byCoordinate.entries()].filter(([, count]) => count > 3);
    if (stillStacked.length > 0) {
      console.log('\nWARNING — repoint still leaves people stacked:');
      for (const [key, count] of stillStacked) console.log(`  ${key}: ${count}`);
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run. Set DRY_RUN=0 FIX_PIN_SATURATION_APPLY=1 to apply.');
      return;
    }

    const releaseId = (
      await client.query<{ release_id: string }>(
        `SELECT release_id FROM bb_public.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    await client.query('BEGIN');
    try {
      for (const entry of resolved) {
        const location = {
          lat: entry.lat,
          lng: entry.lng,
          geohash: entry.geohash,
          precision: 'city',
          matchMethod: 'city_centroid_from_documented_birthplace',
          geohashPrefixes: geohashPrefixes(entry.geohash),
        };
        const locationJson = JSON.stringify(location);
        const label = `${entry.city}, ${entry.state}`;
        await client.query(
          `UPDATE bb_public.release_entities
           SET location = $3::jsonb,
               lat = ($3::jsonb ->> 'lat')::double precision,
               lng = ($3::jsonb ->> 'lng')::double precision,
               geohash = $3::jsonb ->> 'geohash',
               projection = jsonb_set(
                 jsonb_set(projection, '{location}', $3::jsonb, true),
                 '{locationLabel}', to_jsonb($4::text), true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id, locationJson, label],
        );
        await client.query(
          `UPDATE bb_public.search_index SET geohash = $3 WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id, entry.geohash],
        );
      }

      for (const entry of clearPin) {
        await client.query(
          `UPDATE bb_public.release_entities
           SET location = NULL, lat = NULL, lng = NULL, geohash = NULL,
               projection = (projection - 'location') - 'locationLabel'
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id],
        );
        await client.query(
          `UPDATE bb_public.search_index SET geohash = NULL WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id],
        );
      }

      await client.query('COMMIT');
      console.log(`\nApplied. Repointed ${resolved.length}, cleared ${clearPin.length}.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    await auditPinSaturation(client, 'after');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

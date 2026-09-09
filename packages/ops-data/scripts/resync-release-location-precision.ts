/**
 * Re-run the location precision engine over a published release and write BOTH stores.
 *
 * bb_public.release_entities keeps a location twice: as the `location` column (plus the scalar
 * lat/lng/geohash columns) and inside `projection->'location'`. Post-publish geocode lanes have
 * written the column and skipped the projection JSON, so the two drifted (repo-e1uib): 1,593 rows
 * on rel_20260723_authority_net_001, including 1,592 rows whose column geohash is 9 characters
 * because a lane called the geohash helper without the builder's precision argument and picked up
 * DEFAULT_GEOHASH_PRECISION (9) instead of the publish path's 5.
 *
 * Rather than copy one store onto the other — neither is a validly published value on its own —
 * this rebuilds both from the canonical source through the same engine the release builder runs
 * (`docs/security/location-precision-standard.md` §4, "One engine on the publish path"). The
 * algorithm here mirrors release-builder.ts's location block exactly, including the part that is
 * easy to get wrong: `redactLocationForPublic` runs ONLY when `reducePublicPrecision` actually
 * reduced. An unreduced tier keeps its raw point at the builder's geohash precision; it is not
 * coarsened to the tier's GEOHASH_LENGTH/COORDINATE_DECIMALS.
 *
 * Source of truth per row: bb_canonical.entity_locations (role precedence current > approximate >
 * historical, then most recently updated). Rows with no canonical location keep their published
 * point and are only re-normalized through the engine.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/resync-release-location-precision.ts
 *
 * Apply:
 *   DRY_RUN=0 RESYNC_RELEASE_LOCATION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/resync-release-location-precision.ts
 */
import pg from 'pg';
import { buildGeoPointFields, type GeoPointFields } from '@repo/domain/geography/geohash';
import { reducePublicPrecision, redactLocationForPublic } from '@repo/security/redaction';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.RESYNC_RELEASE_LOCATION_APPLY === '1';
const RELEASE_ID = process.env.RELEASE_ID?.trim() || 'rel_20260723_authority_net_001';
/** The release builder's own default (release-builder.ts: `context.geohashPrecision ?? 5`). */
const GEOHASH_PRECISION = 5;

const SELECT_SQL = `
WITH canon AS (
  SELECT DISTINCT ON (el.entity_id)
    el.entity_id, el.precision, el.match_method, el.lat, el.lng
  FROM bb_canonical.entity_locations el
  ORDER BY el.entity_id,
    CASE el.role WHEN 'current' THEN 0 WHEN 'approximate' THEN 1 ELSE 2 END,
    el.updated_at DESC NULLS LAST, el.id
)
SELECT re.entity_id, re.kind,
       re.projection->'location' AS ploc,
       re.location AS cloc,
       re.projection->>'livingStatus' AS living,
       re.projection->>'sensitivityClass' AS sens,
       c.precision AS canon_precision, c.match_method AS canon_match,
       c.lat AS canon_lat, c.lng AS canon_lng
FROM bb_public.release_entities re
LEFT JOIN canon c ON c.entity_id = re.entity_id
WHERE re.release_id = $1 AND re.projection ? 'location'
ORDER BY re.entity_id
`;

const UPDATE_SQL = `
UPDATE bb_public.release_entities
SET location = $3::jsonb,
    lat = $4, lng = $5, geohash = $6,
    projection = jsonb_set(projection, '{location}', $3::jsonb, true)
WHERE release_id = $1 AND entity_id = $2
`;

type Row = {
  entity_id: string;
  kind: string;
  ploc: Record<string, unknown>;
  cloc: Record<string, unknown> | null;
  living: string | null;
  sens: string | null;
  canon_precision: string | null;
  canon_match: string | null;
  canon_lat: number | null;
  canon_lng: number | null;
};

/**
 * Key-order-independent serialization. jsonb returns object keys in its own order (shortest
 * first, then bytewise), which is never the insertion order of the rebuilt object, so a plain
 * JSON.stringify comparison reports every row as changed.
 */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}

/** Mirrors the location block of buildReleaseEntityArtifacts (release-builder.ts). */
function rebuild(row: Row): Record<string, unknown> {
  const src = row.ploc;
  const rawPrecision = String(row.canon_precision ?? src['precision'] ?? '');
  const matchMethod =
    row.canon_match ?? (src['matchMethod'] as string | undefined) ?? 'manual_research';
  const lat = row.canon_lat ?? (src['lat'] as number);
  const lng = row.canon_lng ?? (src['lng'] as number);

  const geo: GeoPointFields = buildGeoPointFields(lat, lng, GEOHASH_PRECISION);
  const engineInput = {
    precision: rawPrecision,
    kind: row.kind,
    ...(row.living ? { livingStatus: row.living } : {}),
    ...(row.sens ? { sensitivityClass: row.sens as never } : {}),
  };
  const reduction = reducePublicPrecision(engineInput);
  const publicPoint = reduction.reduced
    ? redactLocationForPublic({ ...engineInput, lat: geo.lat, lng: geo.lng, geohash: geo.geohash })
    : undefined;
  const publicGeo: GeoPointFields = reduction.reduced
    ? buildGeoPointFields(
        publicPoint?.lat ?? Math.round(geo.lat),
        publicPoint?.lng ?? Math.round(geo.lng),
        Math.min(GEOHASH_PRECISION, publicPoint?.geohash?.length ?? 1),
      )
    : geo;

  return {
    lat: publicGeo.lat,
    lng: publicGeo.lng,
    geohash: publicGeo.geohash,
    geohashPrefixes: publicGeo.geohashPrefixes,
    precision: reduction.precision,
    matchMethod,
    ...(reduction.reason !== undefined ? { precisionReductionReason: reduction.reason } : {}),
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }
  const client = new pg.Client(normalizePgConnectionString(databaseUrl));
  await client.connect();
  try {
    const { rows } = await client.query<Row>(SELECT_SQL, [RELEASE_ID]);
    const changes: { row: Row; next: Record<string, unknown> }[] = [];
    const moves: Record<string, number> = {};
    const reasons: Record<string, number> = {};
    let projOnly = 0,
      colOnly = 0,
      both = 0;

    for (const row of rows) {
      const next = rebuild(row);
      const pSame = stable(row.ploc) === stable(next);
      const cSame = stable(row.cloc) === stable(next);
      if (pSame && cSame) continue;
      if (!pSame && cSame) projOnly++;
      else if (pSame && !cSame) colOnly++;
      else both++;
      const from = String(row.ploc['precision'] ?? '?');
      const to = String(next['precision']);
      if (from !== to) moves[`${from} -> ${to}`] = (moves[`${from} -> ${to}`] ?? 0) + 1;
      const reason = next['precisionReductionReason'];
      if (typeof reason === 'string') reasons[reason] = (reasons[reason] ?? 0) + 1;
      changes.push({ row, next });
    }

    console.log(
      `release ${RELEASE_ID}: ${rows.length} located rows, ${changes.length} need a rewrite`,
    );
    console.log(
      `  projection-only drift ${projOnly} | column-only drift ${colOnly} | both ${both}`,
    );
    console.log(`  reduction reasons: ${JSON.stringify(reasons)}`);
    console.log('  precision moves:');
    Object.entries(moves)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`    ${k}: ${v}`));

    /*
     * Safety property: this resync must never publish a finer location than what is already
     * published. Precision may only move coarser or sideways onto a controlled synonym, and the
     * geohash may only get shorter. If either is ever violated the run aborts rather than write.
     */
    const TIERS = [
      'none',
      'country',
      'state',
      'county',
      'city',
      'neighborhood',
      'campus',
      'institution',
      'site',
      'address',
    ];
    const finer: string[] = [];
    for (const { row, next } of changes) {
      for (const store of [row.ploc, row.cloc]) {
        if (!store) continue;
        const beforeTier = TIERS.indexOf(String(store['precision'] ?? ''));
        const afterTier = TIERS.indexOf(String(next['precision']));
        const beforeGh = String(store['geohash'] ?? '').length;
        const afterGh = String(next['geohash'] ?? '').length;
        if ((beforeTier >= 0 && afterTier > beforeTier) || afterGh > beforeGh) {
          finer.push(
            `${row.entity_id} (${store['precision']}/${beforeGh} -> ${next['precision']}/${afterGh})`,
          );
        }
      }
    }
    if (finer.length) {
      console.error(`ABORT: ${finer.length} rows would publish a FINER location than today:`);
      finer.slice(0, 10).forEach((f) => console.error(`  ${f}`));
      process.exit(1);
    }
    console.log('  safety: no row gets a finer tier or a longer geohash in either store.');

    const watch = (process.env.SAMPLE_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const samples = watch.length
      ? changes.filter((c) => watch.includes(c.row.entity_id))
      : changes.slice(0, 3);
    if (samples.length) {
      console.log('  sample before/after:');
      for (const { row, next } of samples) {
        console.log(
          `    ${row.entity_id} [${row.kind}] canonical precision=${row.canon_precision ?? '(none)'}`,
        );
        console.log(`      projection: ${stable(row.ploc)}`);
        console.log(`      column    : ${stable(row.cloc)}`);
        console.log(`      rebuilt   : ${stable(next)}`);
      }
    }
    const untouched = watch.filter((id) => !changes.some((c) => c.row.entity_id === id));
    if (untouched.length)
      console.log(`  watched ids already correct (no rewrite): ${untouched.join(', ')}`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY RUN — nothing written. Re-run with DRY_RUN=0 RESYNC_RELEASE_LOCATION_APPLY=1 to apply.',
      );
      return;
    }
    await client.query('BEGIN');
    for (const { row, next } of changes) {
      await client.query(UPDATE_SQL, [
        RELEASE_ID,
        row.entity_id,
        JSON.stringify(next),
        next['lat'],
        next['lng'],
        next['geohash'],
      ]);
    }
    await client.query('COMMIT');
    console.log(`\nAPPLIED: rewrote ${changes.length} rows in both stores.`);
  } finally {
    await client.end();
  }
}

await main();

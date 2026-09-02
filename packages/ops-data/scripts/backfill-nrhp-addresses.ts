/**
 * repo-2qbj (WS2) — zero-cost street-address backfill for NRHP Black heritage listings.
 *
 * `scrape-nrhp-black-heritage-roster.ts` joins the lane to the NPS ArcGIS listings layer
 * (cultural_resources/nrhp_locations/MapServer/0) by NRIS_Refnum for lat/lng only, requesting
 * just `NRIS_Refnum` back. The same layer publishes a street address (or a directional
 * "vicinity of" description) per listing, plus positional-accuracy and boundary metadata NPS
 * already computed. This script re-queries that layer with the fuller field list and turns the
 * result into a location-precision upgrade plan for `bb_canonical.entity_locations` and the
 * active release's `bb_public.release_entities` projection — no geocoding, no LLM, no new source:
 * every value published here is copied verbatim from a field NPS's own service already returns.
 *
 * OUTCOMES (classifyNrhpAddressOutcome, pure — see the test file):
 *   restricted        payload.restrictedAddress is true (the roster's own NPS-sourced flag).
 *                      Never emit an address or geometry for these; the plan only carries a
 *                      recommendation to flag sensitivityClass 'sensitive_site'.
 *   address_found      Layer has a non-empty Address AND Vicinity is not "True": a real street
 *                      address for THIS parcel.
 *   vicinity           Layer's Vicinity flag is "True": the Address field is a directional
 *                      description ("5th Ave., Denny Way, and Cedar St.") that locates the
 *                      general area around a landmark, not the parcel itself — published as
 *                      locality-level text, never as a site-precision pin.
 *   coordinates_only    No usable address/vicinity text, but the layer has geometry.
 *   no_match           The refnum is absent from the layer entirely.
 *
 * TIER PROPOSAL. `NRHP_ADDRESS_TIER_TABLE` is the one exported constant that maps an outcome
 * (plus, for coordinates_only, the layer's own SRC_ACCU positional-accuracy string) to a
 * precision tier. It intentionally reuses this lane's OWN already-published precision vocabulary
 * ('site', 'county', ...) — see `bb_canonical.entity_locations.precision` on the 2,550 rows this
 * lane has already published — rather than `@repo/security`'s narrower internal PRECISION_RANK
 * scale (which has no 'site' level at all). That existing-lane convention is a deliberate call,
 * not an oversight: flag it to the orchestrator if the standards research underway elsewhere
 * lands on a different vocabulary, since this table is the only place that would need to change.
 *
 * SCHEMA GAP (report, don't guess). Neither `bb_canonical.entity_locations` nor
 * `bb_public.release_entities.projection.location` has a column for the raw street-address
 * TEXT — only `label`/`locationLabel` (the entity's display name) and geometry/precision. This
 * script therefore carries the fetched address string in the plan JSON only (`entries[].address`)
 * and does not write it anywhere; `report.counts.addressTextHasNoColumn` says so explicitly so the
 * orchestrator can decide whether a migration is warranted.
 *
 * WRITE SHAPE. The apply path patches BOTH copies the way `fix-place-centroid-locations.ts`
 * does (entity_locations is canonical; release_entities.projection.location is what the site
 * actually reads) — `reconcile-nrhp-county-locations.ts` only ever wrote
 * `bb_research.landscape_candidates` and is not a precedent for the two-copy write.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 NRHP_ADDRESS_BACKFILL_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-nrhp-addresses.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { encodeGeohash, geohashPrefixes } from '@repo/domain/geography/geohash';
import {
  classifyNrhpAddressOutcome,
  classifyVisitability,
  NRHP_ADDRESS_TIER_TABLE,
  parseSrcAccuMeters,
  proposeNrhpTier,
  type NrhpAddressOutcome,
  type NrhpArcgisAttributes,
} from './lib/nrhp-address-classify.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CACHE_DIR = join(REPO_ROOT, '.cache/landscape-intake');
const ARCGIS_CACHE_DIR = join(CACHE_DIR, 'nrhp-arcgis');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.NRHP_ADDRESS_BACKFILL_APPLY === '1';

const LANE = 'nrhp-black-heritage';
const ARCGIS_POINTS_LAYER =
  'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';
const ARCGIS_OUT_FIELDS =
  'NRIS_Refnum,RESNAME,Address,City,County,State,Vicinity,IS_EXTANT,EXTANT_OTH,CONSTRANT,SRC_ACCU,MAP_METHOD,BND_TYPE,ResType';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BATCH_SIZE = 100;
const REQUEST_INTERVAL_MS = 1000;
const GEOHASH_PRECISION = 9;

/** How this script's writes are labeled in `match_method` / `location.matchMethod`. */
const MATCH_METHOD = 'nps-nrhp-arcgis-address';
/** NARA/NPGallery canonical URLs cited alongside the layer are per-entity (roster's own field);
 *  the layer URL itself is the one constant citation every plan row shares. */
const CITATION_LAYER_URL = ARCGIS_POINTS_LAYER;

// ---------------------------------------------------------------------------------------------
// ArcGIS fetch + cache
// ---------------------------------------------------------------------------------------------

type ArcGisFeature = {
  readonly attributes?: Readonly<Record<string, string | number | null>>;
  readonly geometry?: { readonly x?: number; readonly y?: number };
};
type ArcGisResponse = { readonly features?: readonly ArcGisFeature[] };

function toStr(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function attributesFromFeature(feature: ArcGisFeature): NrhpArcgisAttributes | null {
  const a = feature.attributes;
  const refnum = toStr(a?.NRIS_Refnum);
  if (!refnum) return null;
  const x = feature.geometry?.x;
  const y = feature.geometry?.y;
  return {
    refnum,
    resname: toStr(a?.RESNAME),
    address: toStr(a?.Address),
    city: toStr(a?.City),
    county: toStr(a?.County),
    state: toStr(a?.State),
    vicinity: toStr(a?.Vicinity),
    isExtant: toStr(a?.IS_EXTANT),
    extantOther: toStr(a?.EXTANT_OTH),
    constraint: toStr(a?.CONSTRANT),
    srcAccu: toStr(a?.SRC_ACCU),
    mapMethod: toStr(a?.MAP_METHOD),
    boundaryType: toStr(a?.BND_TYPE),
    resType: toStr(a?.ResType),
    lat: typeof y === 'number' ? y : null,
    lng: typeof x === 'number' ? x : null,
  };
}

async function fetchJsonWithRetry(url: string, init: RequestInit): Promise<unknown | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': BROWSER_UA, accept: 'application/json', ...(init.headers ?? {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  return null;
}

/** Batch-cache filename is content-addressed on the sorted refnum list, so a re-run with an
 *  unchanged candidate set fetches nothing and a changed lane only misses the affected batches —
 *  not positional ("batch 3"), which would silently go stale if the candidate set's order or size
 *  ever shifts. */
function batchCacheFilename(refnums: readonly string[]): string {
  const hash = createHash('sha1')
    .update([...refnums].sort().join(','))
    .digest('hex')
    .slice(0, 20);
  return `batch-${hash}.json`;
}

async function fetchArcgisAttributes(
  refnums: readonly string[],
): Promise<Map<string, NrhpArcgisAttributes>> {
  mkdirSync(ARCGIS_CACHE_DIR, { recursive: true });
  const byRefnum = new Map<string, NrhpArcgisAttributes>();
  const sorted = [...new Set(refnums)].sort();

  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const batch = sorted.slice(i, i + BATCH_SIZE);
    const cachePath = join(ARCGIS_CACHE_DIR, batchCacheFilename(batch));

    let data: ArcGisResponse | null;
    let usedCache = false;
    try {
      data = JSON.parse(readFileSync(cachePath, 'utf8')) as ArcGisResponse;
      usedCache = true;
    } catch {
      const where = `NRIS_Refnum IN (${batch.map((r) => `'${r.replace(/'/gu, "''")}'`).join(',')})`;
      const body = new URLSearchParams({
        where,
        outFields: ARCGIS_OUT_FIELDS,
        returnGeometry: 'true',
        outSR: '4326',
        f: 'json',
      });
      data = (await fetchJsonWithRetry(ARCGIS_POINTS_LAYER, {
        method: 'POST',
        body,
      })) as ArcGisResponse | null;
      writeFileSync(cachePath, JSON.stringify(data ?? { features: [] }, null, 2));
    }

    for (const feature of data?.features ?? []) {
      const attrs = attributesFromFeature(feature);
      if (attrs) byRefnum.set(attrs.refnum, attrs);
    }

    if (i % 500 === 0) {
      console.log(
        `  ArcGIS fetch: ${Math.min(i + BATCH_SIZE, sorted.length)}/${sorted.length} refnums (matched so far: ${byRefnum.size})`,
      );
    }
    if (!usedCache && i + BATCH_SIZE < sorted.length) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));
    }
  }

  return byRefnum;
}

// ---------------------------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------------------------

type LandscapeRow = {
  readonly id: string;
  readonly payload: {
    readonly refnum?: string;
    readonly restrictedAddress?: boolean;
    readonly city?: string;
    readonly county?: string;
    readonly state?: string;
    readonly displayName?: string;
    readonly canonicalUrl?: string;
  };
};

type EntityLocationRow = {
  readonly entity_id: string;
  readonly id: string;
  readonly precision: string | null;
  readonly label: string | null;
};

export type NrhpAddressPlanEntry = {
  readonly entityId: string;
  readonly refnum: string;
  readonly outcome: NrhpAddressOutcome;
  readonly address: string | null;
  readonly city: string | null;
  readonly county: string | null;
  readonly state: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly accuracyMeters: number | null;
  readonly mapMethod: string | null;
  readonly boundaryType: string | null;
  readonly extant: NrhpVisitability;
  readonly extantOther: string | null;
  readonly proposedTier: string | null;
  readonly currentTier: string | null;
  readonly flagged: boolean;
  readonly flagReason: string | null;
  readonly canApply: boolean;
  readonly skipReason: string | null;
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const landscapeRes = await pool.query<LandscapeRow>(
    `SELECT id, payload FROM bb_research.landscape_candidates WHERE lane = $1 ORDER BY id`,
    [LANE],
  );
  console.log(`Landscape candidates (lane='${LANE}'): ${landscapeRes.rows.length}`);

  const refnums = landscapeRes.rows
    .map((row) => row.payload.refnum)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);

  console.log(
    `Fetching NPS ArcGIS layer attributes for ${refnums.length} refnums (cached, batched)...`,
  );
  const arcgisByRefnum = await fetchArcgisAttributes(refnums);
  console.log(`ArcGIS layer matched: ${arcgisByRefnum.size}/${refnums.length} refnums.`);

  const entityIds = landscapeRes.rows.map((row) => row.id);
  const entityLocationsRes = await pool.query<EntityLocationRow>(
    `SELECT entity_id, id, precision, label FROM bb_canonical.entity_locations WHERE entity_id = ANY($1)`,
    [entityIds],
  );
  const entityLocationByEntityId = new Map<string, EntityLocationRow>();
  for (const row of entityLocationsRes.rows) entityLocationByEntityId.set(row.entity_id, row);
  console.log(
    `Existing bb_canonical.entity_locations rows for lane: ${entityLocationByEntityId.size}`,
  );

  const releaseRes = await pool.query<{ entity_id: string }>(
    `SELECT entity_id FROM bb_public.release_entities
      WHERE entity_id = ANY($1)
        AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
    [entityIds],
  );
  const releaseEntityIds = new Set(releaseRes.rows.map((row) => row.entity_id));
  console.log(`Active-release rows for lane: ${releaseEntityIds.size}`);

  const entries: NrhpAddressPlanEntry[] = [];
  for (const row of landscapeRes.rows) {
    const refnum = row.payload.refnum;
    if (!refnum) continue;
    const restrictedAddress = row.payload.restrictedAddress === true;
    const feature = arcgisByRefnum.get(refnum) ?? null;
    const outcome = classifyNrhpAddressOutcome({ restrictedAddress, feature });
    const accuracyMeters = feature ? parseSrcAccuMeters(feature.srcAccu) : null;
    const existingLocation = entityLocationByEntityId.get(row.id);
    const currentTier = existingLocation?.precision ?? null;
    const proposal = proposeNrhpTier(outcome, accuracyMeters, currentTier);

    const hasEntityLocationRow = existingLocation !== undefined;
    const hasReleaseRow = releaseEntityIds.has(row.id);
    const hasGeometry = feature?.lat !== null && feature?.lng !== null && feature !== null;
    const writable = outcome !== 'restricted' && outcome !== 'no_match';

    let skipReason: string | null = null;
    if (!writable) skipReason = outcome === 'restricted' ? 'restricted_never_written' : 'no_match';
    else if (!hasGeometry) skipReason = 'no_geometry_on_layer_feature';
    else if (!hasEntityLocationRow) skipReason = 'not_yet_published_no_entity_locations_row';
    else if (!hasReleaseRow) skipReason = 'not_in_active_release';

    entries.push({
      entityId: row.id,
      refnum,
      outcome,
      address: feature?.address ?? null,
      city: feature?.city ?? row.payload.city ?? null,
      county: feature?.county ?? row.payload.county ?? null,
      state: feature?.state ?? row.payload.state ?? null,
      lat: feature?.lat ?? null,
      lng: feature?.lng ?? null,
      accuracyMeters,
      mapMethod: feature?.mapMethod ?? null,
      boundaryType: feature?.boundaryType ?? null,
      extant: classifyVisitability(feature?.isExtant),
      extantOther: feature?.extantOther ?? null,
      proposedTier: proposal.tier,
      currentTier,
      flagged: proposal.flagged,
      flagReason: proposal.flagReason,
      canApply: writable && skipReason === null,
      skipReason,
    });
  }

  const counts = {
    total: entries.length,
    restricted: entries.filter((e) => e.outcome === 'restricted').length,
    address_found: entries.filter((e) => e.outcome === 'address_found').length,
    vicinity: entries.filter((e) => e.outcome === 'vicinity').length,
    coordinates_only: entries.filter((e) => e.outcome === 'coordinates_only').length,
    no_match: entries.filter((e) => e.outcome === 'no_match').length,
    applicable: entries.filter((e) => e.canApply).length,
    skippedNoGeometry: entries.filter((e) => e.skipReason === 'no_geometry_on_layer_feature')
      .length,
    skippedNotPublished: entries.filter(
      (e) => e.skipReason === 'not_yet_published_no_entity_locations_row',
    ).length,
    skippedNotInRelease: entries.filter((e) => e.skipReason === 'not_in_active_release').length,
    addressTextHasNoColumn:
      'bb_canonical.entity_locations and bb_public.release_entities have no street-address ' +
      'column; entries[].address is reported here only and is never written to the database.',
  };

  console.log('\nOutcome counts:');
  console.table({
    restricted: counts.restricted,
    address_found: counts.address_found,
    vicinity: counts.vicinity,
    coordinates_only: counts.coordinates_only,
    no_match: counts.no_match,
    total: counts.total,
  });
  console.log(
    `Applicable (writable, geometry present, published, in active release): ${counts.applicable}`,
  );
  console.log(
    `Skipped — no geometry: ${counts.skippedNoGeometry}, not yet published: ${counts.skippedNotPublished}, ` +
      `not in active release: ${counts.skippedNotInRelease}`,
  );

  for (const outcome of [
    'restricted',
    'address_found',
    'vicinity',
    'coordinates_only',
    'no_match',
  ] as const) {
    const sample = entries.filter((e) => e.outcome === outcome).slice(0, 5);
    if (sample.length === 0) continue;
    console.log(`\nSample: ${outcome}`);
    console.table(
      sample.map((e) => ({
        entityId: e.entityId,
        refnum: e.refnum,
        address: e.address,
        city: e.city,
        proposedTier: e.proposedTier,
        currentTier: e.currentTier,
        accuracyMeters: e.accuracyMeters,
        canApply: e.canApply,
        skipReason: e.skipReason,
      })),
    );
  }

  const generatedAt = new Date().toISOString();
  const reportPath = join(
    CACHE_DIR,
    `nrhp-address-backfill-${generatedAt.replace(/[:.]/gu, '-')}.json`,
  );
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt,
        dryRun: DRY_RUN || !APPLY,
        sourceUrl: ARCGIS_POINTS_LAYER,
        matchMethod: MATCH_METHOD,
        tierTable: NRHP_ADDRESS_TIER_TABLE,
        counts,
        entries,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 NRHP_ADDRESS_BACKFILL_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  let applied = 0;
  let failed = 0;
  for (const entry of entries) {
    if (
      !entry.canApply ||
      entry.proposedTier === null ||
      entry.lat === null ||
      entry.lng === null
    ) {
      continue;
    }
    const locationRow = entityLocationByEntityId.get(entry.entityId);
    if (!locationRow) continue; // canApply already guarantees this, defensive only.

    const geohash = encodeGeohash(entry.lat, entry.lng, GEOHASH_PRECISION);
    const prefixes = geohashPrefixes(geohash);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bb_canonical.entity_locations
            SET geometry = $2::jsonb,
                geometry_type = 'Point',
                location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
                lat = $4, lng = $3,
                geohash = $5, geohash_prefixes = $6,
                precision = $7,
                match_method = $8,
                updated_at = now()
          WHERE id = $1`,
        [
          locationRow.id,
          JSON.stringify({ type: 'Point', coordinates: [entry.lng, entry.lat] }),
          entry.lng,
          entry.lat,
          geohash,
          prefixes,
          entry.proposedTier,
          MATCH_METHOD,
        ],
      );
      await client.query(
        `UPDATE bb_public.release_entities
            SET lat = $2, lng = $3,
                location = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(location, '{lat}', to_jsonb($2::double precision)),
                          '{lng}', to_jsonb($3::double precision)),
                        '{geohash}', to_jsonb($4::text)),
                      '{geohashPrefixes}', to_jsonb($5::text[])),
                    '{precision}', to_jsonb($6::text)),
                  '{matchMethod}', to_jsonb($7::text)
                )
          WHERE entity_id = $1
            AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
        [entry.entityId, entry.lat, entry.lng, geohash, prefixes, entry.proposedTier, MATCH_METHOD],
      );
      await client.query('COMMIT');
      applied += 1;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      failed += 1;
      console.error(`FAILED ${entry.entityId}:`, error);
    } finally {
      client.release();
    }
  }

  console.log(`\nApplied: ${applied}. Failed: ${failed}.`);
  console.log(
    `Citation for every applied row: ${CITATION_LAYER_URL} (plus the roster's own NARA/NPGallery ` +
      'canonical URL, unchanged from scrape-nrhp-black-heritage-roster.ts).',
  );
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

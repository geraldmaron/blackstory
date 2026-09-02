/**
 * repo-el9p (WS3) — populate bb_canonical.entity_visit + entity_locations.street/postal_code
 * from Wikidata, for entities that already carry a stored QID
 * (bb_canonical.entity_identifiers, namespace 'wikidata').
 *
 * Pulled properties:
 *   P856  official website  -> entity_visit.website
 *   P1329 phone number      -> entity_visit.phone_e164 / phone_display
 *   P669  located on street (statement) with qualifier
 *   P670  house number      -> entity_locations.street ("<house number> <street label>")
 *   P281  postal code       -> entity_locations.postal_code
 *   P625  coordinate location -> cross-check only; logged when it disagrees with the stored
 *         entity_locations point by more than COORD_DRIFT_WARN_METERS, never used to rewrite
 *         lat/lng (this script does not touch geometry/lat/lng at all).
 *
 * Eligible entities are the same kinds `publicVisitForTier` (packages/domain/src/geography/
 * visit.ts) will ever attach phone/website to: place, institution, school, organization. Person
 * entities are never queried here.
 *
 * QIDs are batched (100 per SPARQL request, one VALUES clause), rate-limited to 1 request/second,
 * sent with a descriptive User-Agent, and each batch's raw JSON response is cached under
 * .cache/landscape-intake/wikidata-visit/ so a re-run without new entities makes zero network
 * calls.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 BACKFILL_VISIT_FROM_WIKIDATA_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-visit-from-wikidata.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_VISIT_FROM_WIKIDATA_APPLY === '1';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CACHE_DIR = join(REPO_ROOT, '.cache/landscape-intake/wikidata-visit');
const REPORT_DIR = CACHE_DIR;

const BATCH_SIZE = 100;
const FETCH_DELAY_MS = Number(process.env.WIKIDATA_VISIT_FETCH_DELAY_MS ?? 1000);
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'blackstory-ops (visit-contact backfill; contact: operator)';
/** Cross-check-only: Wikidata coordinate vs stored point drift worth logging, in meters. */
const COORD_DRIFT_WARN_METERS = 500;

const ELIGIBLE_KINDS = ['place', 'institution', 'school', 'organization'];

type EntityRow = {
  readonly entity_id: string;
  readonly qid: string;
  readonly lat: number | null;
  readonly lng: number | null;
};

export type WikidataVisitFields = {
  readonly website?: string;
  readonly phone?: string;
  readonly street?: string;
  readonly houseNumber?: string;
  readonly streetLabel?: string;
  readonly postalCode?: string;
  readonly coordLat?: number;
  readonly coordLng?: number;
};

type SparqlBinding = Readonly<Record<string, { readonly value: string } | undefined>>;

type SparqlResponse = {
  readonly results: { readonly bindings: readonly SparqlBinding[] };
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadEligibleEntities(client: pg.Client): Promise<readonly EntityRow[]> {
  const { rows } = await client.query<EntityRow>(
    `SELECT e.id AS entity_id,
            ei.value AS qid,
            loc.lat,
            loc.lng
     FROM bb_canonical.entities e
     JOIN bb_canonical.entity_identifiers ei
       ON ei.entity_id = e.id AND ei.namespace = 'wikidata'
     LEFT JOIN LATERAL (
       SELECT lat, lng FROM bb_canonical.entity_locations el
       WHERE el.entity_id = e.id AND el.lat IS NOT NULL AND el.lng IS NOT NULL
       ORDER BY el.updated_at DESC LIMIT 1
     ) loc ON true
     WHERE e.kind = ANY($1::text[])
     ORDER BY e.id`,
    [ELIGIBLE_KINDS],
  );
  return rows;
}

function batch<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function batchCacheKey(qids: readonly string[]): string {
  return createHash('sha256').update(qids.join(',')).digest('hex').slice(0, 24);
}

function buildSparqlQuery(qids: readonly string[]): string {
  const values = qids.map((qid) => `wd:${qid}`).join(' ');
  return `SELECT ?item ?website ?phone ?street ?streetLabel ?houseNumber ?postalCode ?coord WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P856 ?website. }
  OPTIONAL { ?item wdt:P1329 ?phone. }
  OPTIONAL { ?item wdt:P281 ?postalCode. }
  OPTIONAL { ?item wdt:P625 ?coord. }
  OPTIONAL {
    ?item p:P669 ?streetStatement.
    ?streetStatement ps:P669 ?street.
    OPTIONAL { ?streetStatement pq:P670 ?houseNumber. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

async function fetchSparqlBatch(qids: readonly string[]): Promise<readonly SparqlBinding[]> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `batch-${batchCacheKey(qids)}.json`);
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as SparqlResponse;
    return cached.results.bindings;
  }

  const query = buildSparqlQuery(qids);
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/sparql-results+json' },
    });
    if (res.status !== 429) break;
    const retryAfter = Number(res.headers.get('retry-after') ?? 0);
    await sleep(Math.max(retryAfter * 1000, 2000 * 2 ** attempt));
  }
  if (!res || !res.ok) {
    throw new Error(`Wikidata SPARQL request failed: ${res?.status ?? 'no response'}`);
  }
  const data = (await res.json()) as SparqlResponse;
  writeFileSync(cachePath, JSON.stringify(data, null, 2));
  return data.results.bindings;
}

function qidFromItemUri(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

/** Distance in meters between two lat/lng points (haversine), for the cross-check log only. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function parseWikidataVisitFields(binding: SparqlBinding): WikidataVisitFields {
  const website = binding.website?.value;
  const phone = binding.phone?.value;
  const streetLabel = binding.streetLabel?.value;
  const houseNumber = binding.houseNumber?.value;
  const postalCode = binding.postalCode?.value;
  const coord = binding.coord?.value;
  let coordLat: number | undefined;
  let coordLng: number | undefined;
  // WKT literal shape: "Point(lng lat)"
  const match = coord ? /Point\(([-0-9.]+)\s+([-0-9.]+)\)/u.exec(coord) : null;
  if (match) {
    coordLng = Number(match[1]);
    coordLat = Number(match[2]);
  }
  return {
    ...(website ? { website } : {}),
    ...(phone ? { phone } : {}),
    ...(streetLabel ? { streetLabel } : {}),
    ...(houseNumber ? { houseNumber } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(coordLat !== undefined ? { coordLat } : {}),
    ...(coordLng !== undefined ? { coordLng } : {}),
  };
}

/** "<house number> <street label>", trimmed; undefined when neither piece is present. */
export function composeStreetAddress(fields: WikidataVisitFields): string | undefined {
  const parts = [fields.houseNumber, fields.streetLabel].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(' ').trim() : undefined;
}

type PlanRow = {
  readonly entityId: string;
  readonly qid: string;
  readonly website?: string;
  readonly phone?: string;
  readonly street?: string;
  readonly postalCode?: string;
  readonly coordDriftMeters?: number;
};

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const entities = await loadEligibleEntities(client);
    console.log('=== Backfill entity_visit + entity_locations from Wikidata ===');
    console.log(`Eligible entities with a stored QID: ${entities.length}`);

    const batches = batch(entities, BATCH_SIZE);
    console.log(`Batches (size ${BATCH_SIZE}): ${batches.length}`);

    const byQid = new Map(entities.map((row) => [row.qid, row]));
    const plan: PlanRow[] = [];
    const coordWarnings: { entityId: string; qid: string; driftMeters: number }[] = [];

    for (const [index, group] of batches.entries()) {
      const qids = group.map((row) => row.qid);
      const cachePath = join(CACHE_DIR, `batch-${batchCacheKey(qids)}.json`);
      const wasCached = existsSync(cachePath);
      const bindings = await fetchSparqlBatch(qids);
      if (!wasCached) {
        console.log(`Batch ${index + 1}/${batches.length}: fetched ${qids.length} QIDs`);
        await sleep(FETCH_DELAY_MS);
      }

      for (const binding of bindings) {
        const itemUri = binding.item?.value;
        if (!itemUri) continue;
        const qid = qidFromItemUri(itemUri);
        const entity = byQid.get(qid);
        if (!entity) continue;

        const fields = parseWikidataVisitFields(binding);
        const street = composeStreetAddress(fields);

        let coordDriftMeters: number | undefined;
        if (
          fields.coordLat !== undefined &&
          fields.coordLng !== undefined &&
          entity.lat !== null &&
          entity.lng !== null
        ) {
          coordDriftMeters = haversineMeters(
            entity.lat,
            entity.lng,
            fields.coordLat,
            fields.coordLng,
          );
          if (coordDriftMeters > COORD_DRIFT_WARN_METERS) {
            coordWarnings.push({ entityId: entity.entity_id, qid, driftMeters: coordDriftMeters });
          }
        }

        if (!fields.website && !fields.phone && !street && !fields.postalCode) continue;

        plan.push({
          entityId: entity.entity_id,
          qid,
          ...(fields.website ? { website: fields.website } : {}),
          ...(fields.phone ? { phone: fields.phone } : {}),
          ...(street ? { street } : {}),
          ...(fields.postalCode ? { postalCode: fields.postalCode } : {}),
          ...(coordDriftMeters !== undefined ? { coordDriftMeters } : {}),
        });
      }
    }

    const counts = {
      totalEntities: entities.length,
      planned: plan.length,
      withWebsite: plan.filter((row) => row.website !== undefined).length,
      withPhone: plan.filter((row) => row.phone !== undefined).length,
      withStreet: plan.filter((row) => row.street !== undefined).length,
      withPostalCode: plan.filter((row) => row.postalCode !== undefined).length,
      coordDriftWarnings: coordWarnings.length,
    };
    console.log('\nPlan counts:', counts);
    console.log('\nSample plan rows:');
    console.table(plan.slice(0, 5));
    if (coordWarnings.length > 0) {
      console.log(
        `\n${coordWarnings.length} entities have a Wikidata coordinate drifting >${COORD_DRIFT_WARN_METERS}m ` +
          'from the stored point (cross-check only; lat/lng is never rewritten by this script):',
      );
      console.table(coordWarnings.slice(0, 10));
    }

    mkdirSync(REPORT_DIR, { recursive: true });
    const generatedAt = new Date().toISOString();
    const reportPath = join(REPORT_DIR, `plan-${generatedAt.replace(/[:.]/gu, '-')}.json`);
    writeFileSync(
      reportPath,
      JSON.stringify(
        { generatedAt, dryRun: DRY_RUN || !APPLY, counts, plan, coordWarnings },
        null,
        2,
      ),
    );
    console.log(`\nReport written to ${reportPath}`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 BACKFILL_VISIT_FROM_WIKIDATA_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      for (const row of plan) {
        const sourceId = `wikidata:${row.qid}`;
        if (row.website || row.phone) {
          await client.query(
            `INSERT INTO bb_canonical.entity_visit (entity_id, phone_display, website, source_ids, updated_at)
             VALUES ($1, $2, $3, ARRAY[$4]::text[], now())
             ON CONFLICT (entity_id) DO UPDATE SET
               phone_display = COALESCE(EXCLUDED.phone_display, bb_canonical.entity_visit.phone_display),
               website = COALESCE(EXCLUDED.website, bb_canonical.entity_visit.website),
               source_ids = (
                 SELECT array_agg(DISTINCT id) FROM unnest(
                   bb_canonical.entity_visit.source_ids || EXCLUDED.source_ids
                 ) AS id
               ),
               updated_at = now()`,
            [row.entityId, row.phone ?? null, row.website ?? null, sourceId],
          );
        }
        if (row.street || row.postalCode) {
          await client.query(
            `UPDATE bb_canonical.entity_locations
             SET street = COALESCE($2, street),
                 postal_code = COALESCE($3, postal_code),
                 updated_at = now()
             WHERE entity_id = $1`,
            [row.entityId, row.street ?? null, row.postalCode ?? null],
          );
        }
      }
      await client.query('COMMIT');
      console.log(`\nApplied ${plan.length} entity_visit/entity_locations upserts.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

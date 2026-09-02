/**
 * repo-4vuf (WS5) — resolve primary images for the NRHP Black heritage lane
 * (bb_research.landscape_candidates lane 'nrhp-black-heritage') via Wikidata
 * P649 (NRHP reference number) → P18 (image) → Commons license map.
 *
 * Read-only network calls only:
 *   1. SELECT refnum + entity_id for every lane row whose entity's active-
 *      release projection has no primaryImage yet.
 *   2. Batch-query Wikidata's public SPARQL endpoint (200 refnums/request,
 *      1 req/s, cached under .cache/landscape-intake/wikidata-nrhp-images/
 *      sparql/) for `?item wdt:P649 ?ref` and `OPTIONAL { ?item wdt:P18
 *      ?image }`, recording no_item / item_no_image / image_found per ref.
 *   3. For image_found rows, fetch Commons imageinfo/extmetadata for the
 *      first P18 file (same pacing, cached under .../commons-meta/) through
 *      the existing @repo/domain commons-media client, and decide
 *      auto_propose vs. a license-hold outcome via the same
 *      evaluateCommonsMediaPropose the dry-run-commons-qid-leftover.ts /
 *      promote-commons-auto-propose.ts pair already trusts.
 *   4. Write a plan file shaped as `{ proposes: [...] }` — a drop-in --from
 *      input for promote-commons-auto-propose.ts — plus a counts summary.
 *
 * Never writes to the database or to Storage. DATABASE_URL is used for a
 * single SELECT.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd ../..
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/resolve-nrhp-commons-images.ts
 *
 * Optional env:
 *   NRHP_COMMONS_ENTITY_LIMIT   cap how many lane rows are processed (testing)
 *   NRHP_COMMONS_METADATA_CAP   cap on image_found rows sent to the Commons
 *                                metadata step (default 300, only applied if
 *                                the projected 1 req/s runtime exceeds
 *                                NRHP_COMMONS_METADATA_MINUTES)
 *   NRHP_COMMONS_METADATA_MINUTES  minutes threshold for the cap (default 40)
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  createCommonsMediaClient,
  WIKIMEDIA_USER_AGENT,
  type WikimediaHttpFetch,
} from '../../domain/src/adapters/wikimedia/commons-media-client.ts';
import type { CommonsImageMetadata } from '../../domain/src/adapters/wikimedia/commons-media.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildNrhpCommonsImageRow,
  parseNrhpImageSparqlResults,
  summarizeNrhpCommonsImageRows,
  type NrhpCommonsImageRow,
  type NrhpImageLookup,
  type SparqlNrhpImageResponse,
} from './lib/nrhp-commons-image-plan.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CACHE_DIR = join(REPO_ROOT, '.cache/landscape-intake/wikidata-nrhp-images');
const SPARQL_CACHE_DIR = join(CACHE_DIR, 'sparql');
const COMMONS_CACHE_DIR = join(CACHE_DIR, 'commons-meta');
const OUT_DIR = join(REPO_ROOT, '.cache/landscape-intake');

const LANE = 'nrhp-black-heritage' as const;
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const SPARQL_BATCH_SIZE = 200;
const SPARQL_DELAY_MS = 1000;
const COMMONS_BATCH_DELAY_MS = 1000;
/** BlackStory-ops/1.0 is the descriptive User-Agent required by this repo-4vuf task. */
const SPARQL_USER_AGENT = 'BlackStory-ops/1.0 (https://blackstory.app)';

const ENTITY_LIMIT = process.env.NRHP_COMMONS_ENTITY_LIMIT
  ? Number.parseInt(process.env.NRHP_COMMONS_ENTITY_LIMIT, 10)
  : undefined;
const METADATA_CAP = process.env.NRHP_COMMONS_METADATA_CAP
  ? Number.parseInt(process.env.NRHP_COMMONS_METADATA_CAP, 10)
  : 300;
const METADATA_MINUTES_THRESHOLD = process.env.NRHP_COMMONS_METADATA_MINUTES
  ? Number.parseFloat(process.env.NRHP_COMMONS_METADATA_MINUTES)
  : 40;

type LaneRow = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly refnum: string;
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

/** SELECT only — every refnum + entity_id in the lane whose entity has no primaryImage yet. */
async function loadLaneRows(client: pg.Client): Promise<readonly LaneRow[]> {
  const { rows } = await client.query<LaneRow>(
    `WITH active AS (SELECT release_id FROM bb_public.active_release LIMIT 1)
     SELECT lc.id AS entity_id,
            lc.display_name,
            lc.payload->>'refnum' AS refnum
       FROM bb_research.landscape_candidates lc
       CROSS JOIN active a
       LEFT JOIN bb_public.release_entities re
         ON re.entity_id = lc.id AND re.release_id = a.release_id
      WHERE lc.lane = $1
        AND lc.payload->>'refnum' IS NOT NULL
        AND trim(lc.payload->>'refnum') <> ''
        AND (re.entity_id IS NULL OR re.projection->'primaryImage' IS NULL)
      ORDER BY lc.id`,
    [LANE],
  );
  return rows.filter((r) => /^\d{1,15}$/.test(r.refnum));
}

function cacheKey(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

function readJsonCache<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function writeJsonCache(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  attempts = 5,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers });
    if (response.status !== 429 && response.status !== 503) return response;
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    const waitMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(30_000, 1000 * 2 ** attempt);
    await sleep(waitMs);
    lastError = new Error(`Wikidata HTTP ${response.status}`);
  }
  throw lastError instanceof Error ? lastError : new Error('Wikidata request failed after retries');
}

/**
 * SPARQL step: batch refnums in VALUES clauses of SPARQL_BATCH_SIZE, resolve
 * `?item wdt:P649 ?ref` with `OPTIONAL { ?item wdt:P18 ?image }`, 1 req/s
 * against uncached batches, caching raw responses by query hash.
 */
async function resolveViaSparql(
  refnums: readonly string[],
): Promise<{ readonly lookup: ReadonlyMap<string, NrhpImageLookup>; readonly batches: number }> {
  const batches = chunk(refnums, SPARQL_BATCH_SIZE);
  const merged = new Map<string, { qid?: string; fileTitles: string[] }>();
  let networkBatches = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i]!;
    const values = batch.map((r) => `"${r}"`).join(' ');
    const query = `SELECT ?ref ?item ?image WHERE {\n  VALUES ?ref { ${values} }\n  ?item wdt:P649 ?ref .\n  OPTIONAL { ?item wdt:P18 ?image }\n}`;
    const cachePath = join(SPARQL_CACHE_DIR, `${cacheKey(query)}.json`);
    let body = readJsonCache<SparqlNrhpImageResponse>(cachePath);

    if (!body) {
      const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
      const response = await fetchWithRetry(url, {
        'User-Agent': SPARQL_USER_AGENT,
        Accept: 'application/sparql-results+json',
      });
      if (!response.ok) {
        throw new Error(
          `Wikidata SPARQL HTTP ${response.status} for batch ${i + 1}/${batches.length}`,
        );
      }
      body = (await response.json()) as SparqlNrhpImageResponse;
      writeJsonCache(cachePath, body);
      networkBatches += 1;
      if (i < batches.length - 1) await sleep(SPARQL_DELAY_MS);
    }

    const batchLookup = parseNrhpImageSparqlResults(body);
    for (const [ref, entry] of batchLookup) {
      const existing = merged.get(ref) ?? { fileTitles: [] };
      if (entry.qid && existing.qid === undefined) existing.qid = entry.qid;
      for (const title of entry.fileTitles) {
        if (!existing.fileTitles.includes(title)) existing.fileTitles.push(title);
      }
      merged.set(ref, existing);
    }

    process.stderr.write(
      `SPARQL batch ${i + 1}/${batches.length} (${networkBatches} network, ${i + 1 - networkBatches} cached)\n`,
    );
  }

  return { lookup: merged, batches: networkBatches };
}

/** Caching wrapper around fetch for the Commons imageinfo client, 1 req/s on cache misses. */
function createCachingFetch(): WikimediaHttpFetch {
  mkdirSync(COMMONS_CACHE_DIR, { recursive: true });
  return async (url, init) => {
    const cachePath = join(COMMONS_CACHE_DIR, `${cacheKey(url)}.json`);
    const cached = readJsonCache<unknown>(cachePath);
    if (cached !== undefined) {
      return { ok: true, status: 200, json: async () => cached };
    }
    const response = await fetch(url, init?.headers ? { headers: { ...init.headers } } : {});
    if (!response.ok) {
      return { ok: response.ok, status: response.status, json: async () => response.json() };
    }
    const body = await response.json();
    writeJsonCache(cachePath, body);
    return { ok: true, status: response.status, json: async () => body };
  };
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  let laneRows: readonly LaneRow[];
  try {
    laneRows = await loadLaneRows(client);
  } finally {
    await client.end();
  }

  if (ENTITY_LIMIT !== undefined && Number.isFinite(ENTITY_LIMIT)) {
    laneRows = laneRows.slice(0, ENTITY_LIMIT);
  }
  console.log(`=== resolve-nrhp-commons-images ===`);
  console.log(`Lane rows without a primaryImage: ${laneRows.length}`);

  const refnums = [...new Set(laneRows.map((r) => r.refnum))];
  console.log(`Unique refnums to query: ${refnums.length}`);

  const { lookup: sparqlLookup, batches: sparqlNetworkBatches } = await resolveViaSparql(refnums);

  // Stage 1: build rows for no_item / item_no_image immediately; collect image_found candidates.
  const rows: NrhpCommonsImageRow[] = [];
  const imageFoundCandidates: {
    readonly row: LaneRow;
    readonly lookupEntry: NrhpImageLookup;
  }[] = [];

  for (const row of laneRows) {
    const lookupEntry = sparqlLookup.get(row.refnum);
    if (!lookupEntry?.qid) {
      rows.push(
        buildNrhpCommonsImageRow({
          entityId: row.entity_id,
          displayName: row.display_name,
          refnum: row.refnum,
        }),
      );
      continue;
    }
    if (lookupEntry.fileTitles.length === 0) {
      rows.push(
        buildNrhpCommonsImageRow({
          entityId: row.entity_id,
          displayName: row.display_name,
          refnum: row.refnum,
          lookup: lookupEntry,
        }),
      );
      continue;
    }
    imageFoundCandidates.push({ row, lookupEntry });
  }

  console.log(
    `SPARQL resolved: no_item/item_no_image=${rows.length}, image_found=${imageFoundCandidates.length} ` +
      `(${sparqlNetworkBatches} network SPARQL batches)`,
  );

  // Stage 2: Commons metadata for image_found rows, capped if the projected runtime is long.
  const uniqueFirstTitles = [
    ...new Set(imageFoundCandidates.map((c) => c.lookupEntry.fileTitles[0]!)),
  ];
  const commonsClient = createCommonsMediaClient({
    fetchImpl: createCachingFetch(),
    batchDelayMs: COMMONS_BATCH_DELAY_MS,
    userAgent: WIKIMEDIA_USER_AGENT,
  });
  const projectedBatches = Math.ceil(uniqueFirstTitles.length / commonsClient.batchSize);
  const projectedMinutes = (projectedBatches * COMMONS_BATCH_DELAY_MS) / 1000 / 60;

  let metadataCandidates = imageFoundCandidates;
  let cappedNote: string | undefined;
  if (projectedMinutes > METADATA_MINUTES_THRESHOLD) {
    metadataCandidates = imageFoundCandidates.slice(0, METADATA_CAP);
    cappedNote = `Commons metadata step projected ${projectedMinutes.toFixed(
      1,
    )} min at 1 req/s over ${uniqueFirstTitles.length} files; capped to the first ${METADATA_CAP} image_found rows. SPARQL stage still covered all ${refnums.length} refnums.`;
    console.warn(cappedNote);
  }

  const metadataTitles = [...new Set(metadataCandidates.map((c) => c.lookupEntry.fileTitles[0]!))];
  console.log(`Fetching Commons metadata for ${metadataTitles.length} unique files`);
  const imageMetaMap: ReadonlyMap<string, CommonsImageMetadata> =
    metadataTitles.length > 0
      ? await commonsClient.fetchCommonsImageMetadata(metadataTitles)
      : new Map();

  const metadataFetchedIds = new Set(metadataCandidates.map((c) => c.row.entity_id));
  for (const candidate of imageFoundCandidates) {
    const first = candidate.lookupEntry.fileTitles[0]!;
    const image = metadataFetchedIds.has(candidate.row.entity_id)
      ? (imageMetaMap.get(first) ?? imageMetaMap.get(first.replace(/^File:/i, '')))
      : undefined;
    rows.push(
      buildNrhpCommonsImageRow({
        entityId: candidate.row.entity_id,
        displayName: candidate.row.display_name,
        refnum: candidate.row.refnum,
        lookup: candidate.lookupEntry,
        ...(image !== undefined ? { image } : {}),
      }),
    );
  }

  const counts = summarizeNrhpCommonsImageRows(rows);
  console.log('\n=== Counts ===');
  console.log(JSON.stringify(counts, null, 2));

  const dateStamp = new Date().toISOString().slice(0, 10);
  const outPath = join(OUT_DIR, `nrhp-commons-images-${dateStamp}.json`);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'nrhp-black-heritage-p649-p18',
        lane: LANE,
        laneRowsConsidered: laneRows.length,
        uniqueRefnums: refnums.length,
        counts,
        ...(cappedNote !== undefined ? { metadataCapNote: cappedNote } : {}),
        proposes: rows,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nPlan written: ${outPath}`);

  console.log('\nSample rows:');
  for (const sample of rows.slice(0, 5)) {
    console.log(`  ${sample.entityId} [${sample.stage}/${sample.outcome}] ${sample.displayName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

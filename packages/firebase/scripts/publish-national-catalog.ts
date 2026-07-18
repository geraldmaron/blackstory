/**
 * Publish the national seed catalog (black-book-uda follow-on: 100+ researched entities) into
 * the ACTIVE public release's projections + search index.
 *
 * Reads every JSON file in `packages/firebase/fixtures/national-catalog/`, converts each
 * research entry into a `publicEntityProjectionSchema`-conformant doc (geohash via
 * @black-book/domain's `buildGeoPointFields`, claim ids synthesized when the research entry
 * omitted them), hard-fails if ANY entry does not validate, then batch-writes:
 *   publicReleases/<activeRelease>/entities/<id>   (projection, merge)
 *   publicSearchIndex/<id>                          (search doc, merge)
 *
 * Idempotent: re-running overwrites the same doc ids with the same content. Does NOT touch
 * `publicMeta/activeRelease` — the release pointer stays whatever bootstrap/promotion set.
 *
 * Requires:
 *   BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Firestore write access
 *
 * Usage:
 *   BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-national-catalog.ts
 *   DRY_RUN=1 ... — validate + print without writing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildGeoPointFields } from '@black-book/domain';
import {
  publicEntityProjectionSchema,
  publicSearchIndexSchema,
} from '../src/firestore/types.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
/** Geohash character precision for public anchors — matches the bootstrap fixtures' choice. */
const GEOHASH_PRECISION = 5;

if (!ALLOW && !DRY_RUN) {
  console.error('Refusing to write: set BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
  process.exit(2);
}

const catalogDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/national-catalog');

type CatalogClaim = {
  readonly id?: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref?: string;
  readonly citationLabel: string;
};

type CatalogEntry = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly eraBuckets?: readonly string[];
  readonly topicTags?: readonly string[];
  readonly jurisdictionLabel: string;
  readonly locationPrecision: string;
  readonly locationLabel: string;
  readonly lat: number;
  readonly lng: number;
  readonly claims?: readonly CatalogClaim[];
  readonly historicalContext?: string;
  readonly sensitivityClass?: string;
  readonly status?: string;
};

function loadCatalog(): CatalogEntry[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No catalog files found in ${catalogDir}`);
  }
  const entries: CatalogEntry[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as CatalogEntry[];
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed) entries.push(entry);
    console.log(`  ${file}: ${parsed.length} entries`);
  }
  return entries;
}

function toProjectionDoc(entry: CatalogEntry, releaseId: string) {
  const claims = (entry.claims ?? []).map((claim, index) => ({
    id: claim.id ?? `claim_${entry.id.replace(/^ent_/, '')}_${String(index + 1).padStart(2, '0')}`,
    predicate: claim.predicate,
    object: claim.object,
    confidenceLevel: claim.confidenceLevel,
    citationSource: claim.citationSource,
    ...(claim.citationHref !== undefined ? { citationHref: claim.citationHref } : {}),
    citationLabel: claim.citationLabel,
  }));
  const geo = buildGeoPointFields(entry.lat, entry.lng, GEOHASH_PRECISION);

  const doc = {
    id: entry.id,
    releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    summary: entry.summary,
    location: {
      lat: geo.lat,
      lng: geo.lng,
      geohash: geo.geohash,
      geohashPrefixes: [...geo.geohashPrefixes],
      precision: entry.locationPrecision,
      matchMethod: 'manual_research',
    },
    claimIds: claims.map((claim) => claim.id),
    claims,
    jurisdictionLabel: entry.jurisdictionLabel,
    locationLabel: entry.locationLabel,
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.eraBuckets !== undefined ? { eraBuckets: entry.eraBuckets } : {}),
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    topicTags: entry.topicTags ?? [],
    ...(entry.historicalContext !== undefined ? { historicalContext: entry.historicalContext } : {}),
  };
  return publicEntityProjectionSchema.parse(doc);
}

function toSearchDoc(entry: CatalogEntry, releaseId: string, claimCount: number) {
  const doc = {
    id: entry.id,
    releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    aliases: [],
    summary: entry.summary,
    topicTags: entry.topicTags ?? [],
    jurisdictionState: entry.jurisdictionLabel,
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    eraBuckets: entry.eraBuckets ?? [],
    notabilityBasis: [],
    notabilityLabels: [],
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    recordMaturity: claimCount > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage: claimCount >= 2 ? ('partial' as const) : ('minimal' as const),
    relatedCount: 0,
    claimCount,
  };
  return publicSearchIndexSchema.parse(doc);
}

async function main(): Promise<void> {
  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Catalog: ${catalogDir}`);
  const entries = loadCatalog();

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate entity id in catalog: ${entry.id}`);
    ids.add(entry.id);
  }
  console.log(`Total: ${entries.length} unique entities`);

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  const activeSnap = await db.doc('publicMeta/activeRelease').get();
  const releaseId = activeSnap.data()?.releaseId as string | undefined;
  if (!releaseId) throw new Error('publicMeta/activeRelease missing or has no releaseId');
  console.log(`Active release: ${releaseId}`);

  // Validate EVERYTHING before writing anything; name each failing entry so a bad catalog
  // line reads as "which record, which field", not a bare Zod trace.
  const failures: string[] = [];
  const writes = entries.flatMap((entry) => {
    try {
      const projection = toProjectionDoc(entry, releaseId);
      const search = toSearchDoc(entry, releaseId, projection.claims?.length ?? 0);
      return [{ entry, projection, search }];
    } catch (error) {
      const detail =
        error instanceof Error && 'issues' in error
          ? JSON.stringify((error as { issues: unknown }).issues)
          : String(error);
      failures.push(`${entry.id}: ${detail}`);
      return [];
    }
  });
  if (failures.length > 0) {
    console.error(`INVALID ENTRIES (${failures.length}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    throw new Error(`${failures.length} catalog entries failed validation; nothing written.`);
  }
  console.log(`Validated ${writes.length} projections + ${writes.length} search docs`);

  if (DRY_RUN) {
    for (const { projection } of writes.slice(0, 5)) {
      console.log(`  sample: ${projection.id} — ${projection.displayName} (${projection.kind})`);
    }
    console.log('Dry run complete; nothing written.');
    return;
  }

  // Firestore batches cap at 500 ops; chunk defensively.
  const BATCH_LIMIT = 400;
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };
  for (const { projection, search } of writes) {
    batch.set(db.doc(`publicReleases/${releaseId}/entities/${projection.id}`), projection, {
      merge: true,
    });
    batch.set(db.doc(`publicSearchIndex/${search.id}`), search, { merge: true });
    ops += 2;
    if (ops >= BATCH_LIMIT) await flush();
  }
  await flush();

  const after = await db.collection(`publicReleases/${releaseId}/entities`).get();
  console.log(`Publish complete. Release now holds ${after.size} entity projections.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

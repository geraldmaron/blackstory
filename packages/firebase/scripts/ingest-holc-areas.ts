/**
 * Ingest Mapping Inequality HOLC graded areas — raw GeoJSON to Storage, per-area records to
 * Firestore `holcAreas` (geometry stays in the Storage file; docs carry a geometryRef).
 *
 * RIGHTS GATE: DSL's vector dataset is CC BY-NC-SA 4.0 (see the corrected
 * `mapping-inequality-holc` entry in @repo/domain launch-corpora.ts). `holcAreas` stays
 * client-CLOSED in firestore.rules; any public surface use needs a rights review first.
 *
 * Requires:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1 to validate without writing)
 *   Application Default Credentials with Storage + Firestore write on black-book-efaaf
 *
 * Usage (from repo root):
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-holc-areas.ts --file=/path/to/mappinginequality.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getExternalDataSource, sha256Json } from '@repo/domain';
import { idempotentBatchUpsert, loadExistingHashes } from '../src/external/batch-upsert.ts';
import { recordDatasetAcquisition } from '../src/external/capture.ts';
import { holcAreaSchema, type HolcAreaDoc } from '../src/external/schema.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.APP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
/** Private archive bucket (uniform access, public-access prevention enforced; created
 * 2026-07-18) — never the public-media bucket. */
const BUCKET = `${PROJECT_ID}-raw-sources`;

const SOURCE_ID = 'dsl-mapping-inequality-holc';
const SOURCE_URL = 'https://dsl.richmond.edu/panorama/redlining/static/mappinginequality.json';
const LICENSE =
  'CC BY-NC-SA 4.0 (DSL vector derivatives; NARA source scans public domain) — ' +
  'noncommercial, attribution required';
const VERSION = '2023-full-download';
const STORAGE_PATH = `raw-sources/mapping-inequality/${VERSION}/mappinginequality.json`;

type HolcFeature = {
  readonly properties: {
    readonly area_id: number;
    readonly city: string;
    readonly state: string;
    readonly city_survey?: boolean;
    readonly category?: string;
    readonly grade?: string | null;
    readonly label?: string | null;
    readonly residential?: boolean;
    readonly commercial?: boolean;
    readonly industrial?: boolean;
  };
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  if (!ALLOW && !DRY_RUN) {
    console.error('Refusing to write: set APP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
    process.exit(2);
  }
  const filePath = arg('file');
  if (!filePath || !existsSync(filePath)) {
    console.error('Missing or nonexistent --file= (path to mappinginequality.json)');
    process.exit(2);
  }

  const raw = readFileSync(filePath);
  const datasetChecksum = createHash('sha256').update(raw).digest('hex');
  const geojson = JSON.parse(raw.toString('utf-8')) as { features: readonly HolcFeature[] };
  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Features: ${geojson.features.length}; datasetChecksum: ${datasetChecksum}`);

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }

  const nowIso = new Date().toISOString();
  const docs: HolcAreaDoc[] = [];
  const rejected: string[] = [];
  geojson.features.forEach((feature, featureIndex) => {
    const p = feature.properties;
    if (typeof p?.area_id !== 'number' || !p.city || !p.state || !p.category) {
      rejected.push(`feature ${featureIndex}: missing area_id/city/state/category`);
      return;
    }
    const grade = p.grade && /^[A-E]$/.test(p.grade) ? p.grade : undefined;
    const stable = {
      areaId: p.area_id,
      city: p.city,
      state: p.state,
      grade: grade ?? null,
      category: p.category,
      label: p.label ?? null,
      residential: p.residential === true,
      commercial: p.commercial === true,
      industrial: p.industrial === true,
      citySurvey: p.city_survey === true,
      storagePath: STORAGE_PATH,
      featureIndex,
      source: SOURCE_ID,
      sourceUrl: SOURCE_URL,
      datasetChecksum,
    };
    docs.push(
      holcAreaSchema.parse({
        id: `holc_${p.area_id}`,
        areaId: p.area_id,
        city: p.city,
        state: p.state,
        ...(grade ? { grade } : {}),
        category: p.category,
        ...(p.label ? { label: p.label } : {}),
        residential: p.residential === true,
        commercial: p.commercial === true,
        industrial: p.industrial === true,
        citySurvey: p.city_survey === true,
        geometryRef: { storagePath: STORAGE_PATH, featureIndex },
        source: SOURCE_ID,
        sourceUrl: SOURCE_URL,
        retrievedAt: nowIso,
        contentHash: sha256Json(stable).digest,
        datasetChecksum,
        license: LICENSE,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    );
  });
  console.log(`Parsed ${docs.length} area docs; ${rejected.length} rejected`);
  rejected.slice(0, 5).forEach((r) => console.log(`  rejected: ${r}`));

  if (DRY_RUN) {
    console.log('Dry-run: no writes.');
    return;
  }

  if (!process.argv.includes('--skip-storage-upload')) {
    console.log(`Uploading raw GeoJSON to gs://${BUCKET}/${STORAGE_PATH} …`);
    const bucket = getStorage().bucket(BUCKET);
    await bucket.upload(filePath, {
      destination: STORAGE_PATH,
      metadata: { contentType: 'application/geo+json', metadata: { sha256: datasetChecksum, sourceUrl: SOURCE_URL } },
    });
    await bucket.file(`${STORAGE_PATH}.sha256`).save(`${datasetChecksum}  mappinginequality.json\n`);
    console.log('Upload complete.');
  }

  const firestore = getFirestore();
  const collection = firestore.collection('holcAreas');
  const existing = await loadExistingHashes(collection);
  const summary = await idempotentBatchUpsert(firestore, collection, docs, existing);

  // Provenance chain (evidenceSources → sourceItems → retrievalEvents → sourceCaptures).
  const registryEntry = getExternalDataSource('mapping-inequality-holc');
  if (!registryEntry) throw new Error('external-data-sources registry entry missing');
  const acquisition = await recordDatasetAcquisition({
    firestore,
    registryEntry,
    contentHashHex: datasetChecksum,
    retrievedAt: nowIso,
    snapshotStorageObject: `gs://${BUCKET}/${STORAGE_PATH}`,
    parserVersion: 'ingest-holc-areas-v1',
    httpStatus: 200,
  });

  console.log(JSON.stringify({ ...summary, rejected: rejected.length, acquisition }, null, 2));
}

await main();

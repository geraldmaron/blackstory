/**
 * Ingest the Opportunity Atlas tract outcomes (tract_outcomes_early.csv) —
 * raw artifact to Storage, curated starter subset to Firestore `opportunityAtlasTracts`.
 *
 * Source registry entry: @blap/domain external-data-sources.ts `opportunity-atlas-tract-outcomes`
 * (attribution required). 2010 tract geography (`tractVintage: '2010'`).
 *
 * Reliability screening: an outcome cell is retained only when its matching `*_n` count is
 * ≥ MIN_RELIABLE_N; dropped cells land in `suppressed`. Rows with no retained outcome at all
 * are skipped entirely (counted in the summary) — publishing pure noise helps no one.
 *
 * Requires:
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1 to validate without writing)
 *   Application Default Credentials with Storage + Firestore write on black-book-efaaf
 *
 * Usage (from repo root):
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-opportunity-atlas.ts \
 *     --file=/path/to/tract_outcomes_early.csv [--skip-storage-upload]
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getExternalDataSource, sha256Json } from '@blap/domain';
import { idempotentBatchUpsert, loadExistingHashes } from '../src/external/batch-upsert.ts';
import { recordDatasetAcquisition } from '../src/external/capture.ts';
import { opportunityAtlasTractSchema, type OpportunityAtlasTractDoc } from '../src/external/schema.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.BLAP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
/** Private archive bucket (uniform access, public-access prevention enforced; created
 * 2026-07-18) — never the public-media bucket. */
const BUCKET = `${PROJECT_ID}-raw-sources`;

const SOURCE_ID = 'opportunity-insights-tract-outcomes';
const SOURCE_URL =
  'https://opportunityinsightsstatic.s3.us-east-1.amazonaws.com/assets/tract_outcomes_early.csv';
const LICENSE = 'Opportunity Insights data-use terms — attribution required';
const VERSION = 'tract_outcomes_early-2018';
const STORAGE_PATH = `raw-sources/opportunity-atlas/${VERSION}/tract_outcomes_early.csv`;

/** Below this many underlying children, an estimate is dropped as unreliable. */
const MIN_RELIABLE_N = 20;

/** CSV column → doc field, each value gated by its reliability-count column. */
const OUTCOME_COLUMNS: readonly {
  readonly column: string;
  readonly field: string;
  readonly nColumn: string;
  readonly nField: string;
}[] = [
  { column: 'kfr_pooled_pooled_p25', field: 'kfrPooledP25', nColumn: 'kfr_pooled_pooled_n', nField: 'kfrPooledN' },
  { column: 'kfr_pooled_pooled_p75', field: 'kfrPooledP75', nColumn: 'kfr_pooled_pooled_n', nField: 'kfrPooledN' },
  { column: 'kfr_black_pooled_p25', field: 'kfrBlackP25', nColumn: 'kfr_black_pooled_n', nField: 'kfrBlackN' },
  { column: 'kfr_white_pooled_p25', field: 'kfrWhiteP25', nColumn: 'kfr_white_pooled_n', nField: 'kfrWhiteN' },
  { column: 'jail_black_pooled_p25', field: 'jailBlackP25', nColumn: 'jail_black_pooled_n', nField: 'jailBlackN' },
  { column: 'jail_pooled_pooled_p25', field: 'jailPooledP25', nColumn: 'jail_pooled_pooled_n', nField: 'jailPooledN' },
];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve())
      .on('error', reject);
  });
  return hash.digest('hex');
}

async function main(): Promise<void> {
  if (!ALLOW && !DRY_RUN) {
    console.error('Refusing to write: set BLAP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
    process.exit(2);
  }
  const filePath = arg('file');
  if (!filePath || !existsSync(filePath)) {
    console.error('Missing or nonexistent --file= (path to tract_outcomes_early.csv)');
    process.exit(2);
  }

  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log('Hashing artifact…');
  const datasetChecksum = await sha256File(filePath);
  console.log(`datasetChecksum: ${datasetChecksum}`);

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }

  if (!DRY_RUN && !process.argv.includes('--skip-storage-upload')) {
    console.log(`Uploading raw CSV to gs://${BUCKET}/${STORAGE_PATH} …`);
    const bucket = getStorage().bucket(BUCKET);
    await bucket.upload(filePath, {
      destination: STORAGE_PATH,
      resumable: true,
      metadata: { contentType: 'text/csv', metadata: { sha256: datasetChecksum, sourceUrl: SOURCE_URL } },
    });
    await bucket.file(`${STORAGE_PATH}.sha256`).save(`${datasetChecksum}  tract_outcomes_early.csv\n`);
    console.log('Upload complete.');
  }

  // Stream-parse: 2.6GB, 7,897 columns — never buffer the file.
  const nowIso = new Date().toISOString();
  const docs: OpportunityAtlasTractDoc[] = [];
  let header: string[] | null = null;
  let colIndex = new Map<string, number>();
  let skippedNoOutcome = 0;
  let badRows = 0;

  const lines = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!header) {
      header = line.split(',').map((c) => c.replace(/^"|"$/g, ''));
      colIndex = new Map(header.map((name, idx) => [name, idx]));
      const missing = ['state', 'county', 'tract', ...OUTCOME_COLUMNS.flatMap((c) => [c.column, c.nColumn])]
        .filter((c) => !colIndex.has(c));
      if (missing.length > 0) throw new Error(`CSV header missing expected columns: ${missing.join(', ')}`);
      continue;
    }
    const cells = line.split(',');
    const state = (cells[colIndex.get('state')!] ?? '').padStart(2, '0');
    const county = (cells[colIndex.get('county')!] ?? '').padStart(3, '0');
    const tract = (cells[colIndex.get('tract')!] ?? '').padStart(6, '0');
    if (!/^\d{2}$/.test(state) || !/^\d{3}$/.test(county) || !/^\d{6}$/.test(tract)) {
      badRows += 1;
      continue;
    }

    const outcomes: Record<string, number> = {};
    const suppressed: string[] = [];
    for (const spec of OUTCOME_COLUMNS) {
      const raw = cells[colIndex.get(spec.column)!];
      const nRaw = cells[colIndex.get(spec.nColumn)!];
      const value = raw === '' || raw === undefined ? NaN : Number(raw);
      const n = nRaw === '' || nRaw === undefined ? 0 : Number(nRaw);
      if (!Number.isFinite(value) || !Number.isFinite(n) || n < MIN_RELIABLE_N) {
        suppressed.push(spec.field);
        continue;
      }
      outcomes[spec.field] = value;
      outcomes[spec.nField] = n;
    }
    if (Object.keys(outcomes).length === 0) {
      skippedNoOutcome += 1;
      continue;
    }

    const geoid11 = `${state}${county}${tract}`;
    const stable = {
      geoid11,
      outcomes,
      suppressed: [...new Set(suppressed)].sort(),
      source: SOURCE_ID,
      sourceUrl: SOURCE_URL,
      datasetChecksum,
    };
    docs.push(
      opportunityAtlasTractSchema.parse({
        id: geoid11,
        geoid11,
        fips5: `${state}${county}`,
        stateFips: state,
        countyFips: county,
        tractCode: tract,
        tractVintage: '2010',
        outcomes,
        suppressed: stable.suppressed,
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
  }

  console.log(
    `Parsed: ${docs.length} docs; skipped ${skippedNoOutcome} rows with no reliable outcome; ${badRows} bad FIPS rows`,
  );
  if (DRY_RUN) {
    console.log('Dry-run: no writes.');
    return;
  }

  const firestore = getFirestore();
  const collection = firestore.collection('opportunityAtlasTracts');

  console.log('Reading existing contentHashes…');
  const existing = await loadExistingHashes(collection);
  const summary = await idempotentBatchUpsert(firestore, collection, docs, existing);

  // Provenance chain (evidenceSources → sourceItems → retrievalEvents → sourceCaptures) —
  // the harness record of this acquisition, alongside the per-doc datasetChecksum.
  const registryEntry = getExternalDataSource('opportunity-atlas-tract-outcomes');
  if (!registryEntry) throw new Error('external-data-sources registry entry missing');
  const acquisition = await recordDatasetAcquisition({
    firestore,
    registryEntry,
    contentHashHex: datasetChecksum,
    retrievedAt: nowIso,
    snapshotStorageObject: `gs://${BUCKET}/${STORAGE_PATH}`,
    parserVersion: 'ingest-opportunity-atlas-v1',
    httpStatus: 200,
  });

  console.log(JSON.stringify({ ...summary, skippedNoOutcome, badRows, acquisition }, null, 2));
}

await main();

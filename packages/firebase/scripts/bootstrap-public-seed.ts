/**
 * Bootstrap a minimal public Firestore seed into (default DB).
 *
 * Writes ONLY the public-read projection subset + policy pointer + a stub publication
 * release so `publicMeta/activeRelease` is coherent. Does NOT write quarantine/canonical
 * research collections.
 *
 * Requires:
 * BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1
 * Application Default Credentials with Firestore write access
 *
 * Usage:
 * BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 * packages/firebase/scripts/bootstrap-public-seed.ts
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { preparePublicEntityProjectionForWrite } from '../src/index.ts';
import {
  firestoreSeedDocuments,
  seedActiveRelease,
  seedPolicyActive,
  seedPublicEntity,
  seedPublicSchoolEntity,
} from '../fixtures/firestore-seed.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!ALLOW) {
  console.error('Refusing to write: set BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION=1');
  process.exit(2);
}

/** Public browse surface only not submissions/canonical research.  */
const PUBLIC_PATH_PREFIXES = [
  'policy/',
  'policyVersions/',
  'publicMeta/',
  'publicReleases/',
  'publicSearchIndex/',
  'publicationReleases/',
] as const;

function isPublicBootstrapPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

const stubPublicationRelease = {
  path: 'publicationReleases/rel_seed_001',
  data: {
    releaseId: 'rel_seed_001',
    status: 'active',
    searchIndexVersion: seedActiveRelease.searchIndexVersion,
    createdAt: seedActiveRelease.activatedAt,
    createdBy: 'bootstrap-public-seed',
    activatedAt: seedActiveRelease.activatedAt,
    notes: 'Bootstrap seed release for black-book-efaaf stand-up (not a signed production promote).',
    signedManifest: {
      manifestHash: seedActiveRelease.manifestHash,
      algorithm: 'bootstrap-unsigned',
      signature: 'bootstrap',
    },
  },
};

const docs = [
  ...firestoreSeedDocuments.filter((doc) => isPublicBootstrapPath(doc.path)),
  stubPublicationRelease,
];

// Ensure core public projections are present even if fixture list changes.
const ensured = new Map(docs.map((doc) => [doc.path, doc]));
ensured.set('policy/active', { path: 'policy/active', data: seedPolicyActive });
ensured.set('publicMeta/activeRelease', {
  path: 'publicMeta/activeRelease',
  data: seedActiveRelease,
});
ensured.set('publicReleases/rel_seed_001/entities/ent_seed_place_001', {
  path: 'publicReleases/rel_seed_001/entities/ent_seed_place_001',
  data: preparePublicEntityProjectionForWrite(seedPublicEntity),
});
ensured.set('publicReleases/rel_seed_001/entities/ent_seed_school_001', {
  path: 'publicReleases/rel_seed_001/entities/ent_seed_school_001',
  data: preparePublicEntityProjectionForWrite(seedPublicSchoolEntity),
});

const toWrite = [...ensured.values()].sort((a, b) => a.path.localeCompare(b.path));

async function main(): Promise<void> {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Documents: ${toWrite.length}${DRY_RUN ? ' (dry-run)' : ''}`);
  for (const doc of toWrite) {
    console.log(`  ${doc.path}`);
  }

  if (DRY_RUN) {
    return;
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    });
  }

  const db = getFirestore();
  const batch = db.batch();
  for (const doc of toWrite) {
    batch.set(db.doc(doc.path), doc.data, { merge: true });
  }
  await batch.commit();

  const active = await db.doc('publicMeta/activeRelease').get();
  const entities = await db.collection('publicReleases/rel_seed_001/entities').get();
  console.log('activeRelease:', active.exists ? active.data()?.releaseId : 'MISSING');
  console.log('entity count:', entities.size);
  console.log('Bootstrap complete.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

/**
 * Read-only census of production Firestore: counts for canonical, research,
 * and public-release collections plus the active release pointer. No writes.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/firestore-census.ts
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}
const db = getFirestore();

async function count(path: string): Promise<number | string> {
  try {
    const snap = await db.collection(path).count().get();
    return snap.data().count;
  } catch (error) {
    return `error: ${error instanceof Error ? error.message.slice(0, 80) : String(error)}`;
  }
}

async function main(): Promise<void> {
  const activeReleaseDoc = await db.doc('publicMeta/activeRelease').get();
  const activeRelease = activeReleaseDoc.exists
    ? (activeReleaseDoc.data()?.releaseId ?? JSON.stringify(activeReleaseDoc.data()))
    : '(missing)';
  console.log(`project: ${PROJECT_ID}`);
  console.log(`publicMeta/activeRelease: ${activeRelease}`);

  const collections: string[] = [
    'canonicalEntities',
    'canonicalClaims',
    'claimEvidenceLinks',
    'entityRelationships',
    'evidenceRecords',
    'evidenceSources',
    'sourceItems',
    'researchCases',
    'submissionInbox',
    'publicSearchIndex',
    'discoveryCampaignRuns',
    'auditEvents',
  ];
  for (const name of collections) {
    console.log(`${name}: ${await count(name)}`);
  }
  if (typeof activeRelease === 'string' && activeRelease !== '(missing)') {
    console.log(
      `publicReleases/${activeRelease}/entities: ${await count(`publicReleases/${activeRelease}/entities`)}`,
    );
    console.log(
      `publicReleases/${activeRelease}/graphAdjacency: ${await count(`publicReleases/${activeRelease}/graphAdjacency`)}`,
    );
  }
  const byState = await db.collection('researchCases').select('state').get();
  const states = new Map<string, number>();
  for (const doc of byState.docs) {
    const state = (doc.data().state as string) ?? '(none)';
    states.set(state, (states.get(state) ?? 0) + 1);
  }
  console.log('researchCases by state:', Object.fromEntries([...states.entries()].sort()));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

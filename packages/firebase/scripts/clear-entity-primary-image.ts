/**
 * Remove a wrong or uncleared primaryImage from the active-release Firestore
 * projection and optionally delete the public-media object.
 *
 * Prefer this over shipping a mismatched substitute when no rights-cleared
 * town/site photo is ready (learning-index honesty gap).
 *
 * Requires:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Storage + Firestore write
 *
 * Usage (repo root):
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/clear-entity-primary-image.ts \
 *     --entity-id=ent_nicodemus_001 \
 *     --delete-object=1
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  DEFAULT_PUBLIC_MEDIA_BUCKET,
  entityPrimaryImageObjectPath,
  firestorePaths,
} from '../src/index.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.APP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function requireArg(name: string): string {
  const value = arg(name);
  if (!value) {
    console.error(`Missing required --${name}=`);
    process.exit(2);
  }
  return value;
}

async function main(): Promise<void> {
  if (!ALLOW) {
    console.error('Refusing to write: set APP_FIREBASE_ALLOW_PRODUCTION=1');
    process.exit(2);
  }

  const entityId = requireArg('entity-id');
  const releaseId = arg('release-id') ?? 'rel_seed_001';
  const deleteObject = (arg('delete-object') ?? '1') !== '0';
  const bucketName = arg('bucket') ?? DEFAULT_PUBLIC_MEDIA_BUCKET;

  const docPath = firestorePaths.publicEntity(releaseId, entityId);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Projection: ${docPath}`);
  console.log(`Delete object: ${deleteObject}${DRY_RUN ? ' (dry-run)' : ''}`);

  if (DRY_RUN) return;

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
      storageBucket: bucketName,
    });
  }

  const db = getFirestore();
  const docRef = db.doc(docPath);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`Projection missing: ${docPath}`);
    process.exit(1);
  }

  const data = snap.data() as { primaryImage?: { objectPath?: string; url?: string } };
  const objectPath =
    data.primaryImage?.objectPath ?? entityPrimaryImageObjectPath(entityId, 'primary.jpg');

  await docRef.update({ primaryImage: FieldValue.delete() });
  console.log('Cleared primaryImage from projection.');

  if (deleteObject) {
    const file = getStorage().bucket(bucketName).file(objectPath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete({ ignoreNotFound: true });
      console.log(`Deleted gs://${bucketName}/${objectPath}`);
    } else {
      // Also try .png / .webp variants if objectPath was inferred.
      for (const name of ['primary.png', 'primary.webp', 'primary.jpeg'] as const) {
        const altPath = entityPrimaryImageObjectPath(entityId, name);
        if (altPath === objectPath) continue;
        const alt = getStorage().bucket(bucketName).file(altPath);
        const [altExists] = await alt.exists();
        if (altExists) {
          await alt.delete({ ignoreNotFound: true });
          console.log(`Deleted gs://${bucketName}/${altPath}`);
        }
      }
      console.log(`Object not found at ${objectPath} (already gone or different ext).`);
    }
  }

  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

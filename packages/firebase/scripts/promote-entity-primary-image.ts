/**
 * Upload an entity primary image to public-media and patch the active-release
 * Firestore projection with a rights-cleared primaryImage block.
 *
 * Requires:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Storage + Firestore write on black-book-efaaf
 *
 * Usage (from packages/firebase):
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 \
 *   node --conditions development --import tsx scripts/promote-entity-primary-image.ts \
 *     --entity-id=ent_seed_school_001 \
 *     --file=../../brand/symbols/dark/blap-book-pin-symbol-dark-transparent.png \
 *     --alt="Campus exterior of Seed Freedmen School" \
 *     --credit="Public domain archival fixture" \
 *     --rights=public_domain \
 *     --release-id=rel_seed_001
 */
import { existsSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  entityPrimaryImageObjectRef,
  preparePublicEntityProjectionForWrite,
  publicEntityProjectionSchema,
  type PublicEntityProjectionDoc,
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
  const filePath = requireArg('file');
  const alt = requireArg('alt');
  const credit = requireArg('credit');
  const rights = (arg('rights') ?? 'public_domain') as 'public_domain' | 'licensed' | 'fair_use';
  const releaseId = arg('release-id') ?? 'rel_seed_001';
  const contentType = arg('content-type') ?? guessContentType(filePath);

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }
  if (!['public_domain', 'licensed', 'fair_use'].includes(rights)) {
    console.error(`Unsupported rights status: ${rights}`);
    process.exit(2);
  }

  const filename = `primary${extname(filePath) || '.png'}`;
  const ref = entityPrimaryImageObjectRef(entityId, { filename });

  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Entity: ${entityId}`);
  console.log(`Upload: gs://${ref.bucket}/${ref.objectPath}`);
  console.log(`URL: ${ref.publicUrl}`);
  console.log(`Release: ${releaseId}${DRY_RUN ? ' (dry-run)' : ''}`);

  if (DRY_RUN) return;

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
      storageBucket: ref.bucket,
    });
  }

  const bucket = getStorage().bucket(ref.bucket);
  await bucket.upload(filePath, {
    destination: ref.objectPath,
    metadata: {
      contentType,
      metadata: {
        entityId,
        purpose: 'entity-primary-image',
        rightsStatus: rights,
        sourceFile: basename(filePath),
      },
    },
    resumable: false,
  });

  try {
    await bucket.file(ref.objectPath).makePublic();
  } catch (error) {
    console.warn(
      'makePublic failed (bucket may enforce PAP/CDN-only). Projection will still store objectPath + URL.',
      error instanceof Error ? error.message : error,
    );
  }

  const db = getFirestore();
  const docRef = db.doc(`publicReleases/${releaseId}/entities/${entityId}`);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`Projection missing: ${docRef.path} — run bootstrap-public-seed first.`);
    process.exit(1);
  }

  const existing = publicEntityProjectionSchema.parse(snap.data());
  const next: PublicEntityProjectionDoc = preparePublicEntityProjectionForWrite({
    ...existing,
    primaryImage: {
      url: ref.publicUrl,
      alt,
      credit,
      rightsStatus: rights,
      objectPath: ref.objectPath,
    },
  });

  await docRef.set(next, { merge: false });
  console.log('Projection updated with primaryImage.');
  console.log('Done.');
}

function guessContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

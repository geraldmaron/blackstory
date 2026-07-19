/**
 * Batch-promote Commons auto_propose images from a dry-run JSON into
 * public-media + active-release entity projections.
 *
 * Downloads Commons source URLs (metadata already rights-gated by the dry-run),
 * uploads to GCS public-media, and patches `primaryImage` on each projection.
 *
 * Requires:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Storage + Firestore write
 *
 * Usage (repo root):
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/promote-commons-auto-propose.ts \
 *     --from=packages/firebase/fixtures/release-artifacts/commons-media-dry-run.json
 *
 * Optional:
 *   --limit=N
 *   --concurrency=2
 *   --retry-failures=path.json
 *   --skip-existing=0  (default skips entities that already have primaryImage.url)
 *   DRY_RUN=1
 */
import { createWriteStream, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { sanitizePrimaryImageForRelease } from '@repo/domain';
import { entityPrimaryImageObjectRef } from '../src/index.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.APP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const USER_AGENT =
  'BlackStoryCommonsEnrichment/1.0 (https://blackstory.app; promote-batch; mailto:ops@blackstory.app)';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultFrom = join(
  scriptDir,
  '../fixtures/release-artifacts/commons-media-dry-run.json',
);
const tmpRoot = join(scriptDir, '../fixtures/release-artifacts/.commons-promote-tmp');

type AutoPropose = {
  readonly outcome: string;
  readonly entityId: string;
  readonly displayName: string;
  readonly sourceImageUrl?: string;
  readonly alt?: string;
  readonly credit?: string;
  readonly rightsStatus?: 'public_domain' | 'licensed' | 'fair_use';
  readonly commonsPageUrl?: string;
  readonly fileTitle?: string;
  readonly wikidataId?: string;
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function guessExt(url: string, contentType: string | null): string {
  try {
    const path = new URL(url).pathname;
    const ext = extname(path).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext;
  } catch {
    /* ignore */
  }
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('gif')) return '.gif';
  return '.jpg';
}

function guessContentType(ext: string): string {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadToFile(
  url: string,
  destWithoutExt: string,
  attempts = 8,
): Promise<{ contentType: string; path: string; ext: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*' },
        redirect: 'follow',
      });
      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(60_000, 1500 * 2 ** (attempt - 1));
        await sleep(waitMs);
        continue;
      }
      if (!response.ok || !response.body) {
        throw new Error(`download HTTP ${response.status} for ${url}`);
      }
      const headerType = response.headers.get('content-type');
      const ext = guessExt(url, headerType);
      const path = `${destWithoutExt}${ext}`;
      mkdirSync(dirname(path), { recursive: true });
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(path));
      return {
        contentType: headerType?.split(';')[0]?.trim() || guessContentType(ext),
        path,
        ext,
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(Math.min(60_000, 1500 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  if (!ALLOW && !DRY_RUN) {
    console.error('Refusing to write: set APP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
    process.exit(2);
  }

  const fromPath = arg('from') ?? defaultFrom;
  const limitRaw = arg('limit');
  const limit = limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : undefined;
  const concurrency = Number.parseInt(arg('concurrency') ?? '2', 10);
  const skipExisting = arg('skip-existing') !== '0';
  const onlyFailedPath = arg('retry-failures');

  if (!existsSync(fromPath)) {
    console.error(`Missing dry-run file: ${fromPath}`);
    process.exit(2);
  }

  const payload = JSON.parse(readFileSync(fromPath, 'utf8')) as {
    readonly proposes: readonly AutoPropose[];
  };
  let work = payload.proposes.filter(
    (p) =>
      p.outcome === 'auto_propose' &&
      typeof p.sourceImageUrl === 'string' &&
      p.sourceImageUrl.length > 0 &&
      typeof p.alt === 'string' &&
      typeof p.credit === 'string' &&
      (p.rightsStatus === 'public_domain' ||
        p.rightsStatus === 'licensed' ||
        p.rightsStatus === 'fair_use'),
  );

  if (onlyFailedPath) {
    const failed = JSON.parse(readFileSync(onlyFailedPath, 'utf8')) as {
      readonly failures: readonly { readonly entityId: string }[];
    };
    const ids = new Set(failed.failures.map((f) => f.entityId));
    work = work.filter((p) => ids.has(p.entityId));
    console.log(`Retrying ${work.length} entities from ${onlyFailedPath}`);
  }

  if (limit !== undefined && Number.isFinite(limit)) {
    work = work.slice(0, limit);
  }

  console.log(`Project: ${PROJECT_ID}`);
  console.log(`From: ${fromPath}`);
  console.log(`Candidates: ${work.length} (concurrency=${concurrency})${DRY_RUN ? ' DRY_RUN' : ''}`);

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    });
  }
  const db = getFirestore();
  const activeSnap = await db.doc('publicMeta/activeRelease').get();
  const releaseId = activeSnap.data()?.releaseId as string | undefined;
  if (!releaseId) {
    console.error('publicMeta/activeRelease missing or has no releaseId');
    process.exit(1);
  }
  console.log(`Active release: ${releaseId}`);

  if (DRY_RUN) {
    console.log('Dry-run sample:');
    for (const p of work.slice(0, 5)) {
      console.log(`  ${p.entityId} ← ${p.sourceImageUrl}`);
    }
    return;
  }

  mkdirSync(tmpRoot, { recursive: true });
  const bucket = getStorage().bucket(entityPrimaryImageObjectRef('probe').bucket);

  const counts = {
    promoted: 0,
    skippedExisting: 0,
    missingProjection: 0,
    downloadFailed: 0,
    uploadFailed: 0,
    writeFailed: 0,
  };
  const failures: { entityId: string; stage: string; error: string }[] = [];

  await mapPool(work, concurrency, async (propose) => {
    const entityId = propose.entityId;
    const docRef = db.doc(`publicReleases/${releaseId}/entities/${entityId}`);
    try {
      const snap = await docRef.get();
      if (!snap.exists) {
        counts.missingProjection += 1;
        failures.push({ entityId, stage: 'projection', error: 'missing' });
        return;
      }

      if (skipExisting && snap.data()?.primaryImage?.url) {
        counts.skippedExisting += 1;
        return;
      }

      await sleep(400);

      let downloaded: { contentType: string; ext: string; path: string };
      try {
        downloaded = await downloadToFile(propose.sourceImageUrl!, join(tmpRoot, entityId));
      } catch (error) {
        counts.downloadFailed += 1;
        failures.push({
          entityId,
          stage: 'download',
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      const filename = `primary${downloaded.ext}`;
      const ref = entityPrimaryImageObjectRef(entityId, { filename });

      try {
        await bucket.upload(downloaded.path, {
          destination: ref.objectPath,
          metadata: {
            contentType: downloaded.contentType,
            metadata: {
              entityId,
              purpose: 'entity-primary-image',
              rightsStatus: propose.rightsStatus!,
              sourceUrl: propose.sourceImageUrl!,
              commonsPageUrl: propose.commonsPageUrl ?? '',
              wikidataId: propose.wikidataId ?? '',
              fileTitle: propose.fileTitle ?? '',
            },
          },
          resumable: false,
        });
        try {
          await bucket.file(ref.objectPath).makePublic();
        } catch {
          /* PAP/CDN — projection still stores URL */
        }
      } catch (error) {
        counts.uploadFailed += 1;
        failures.push({
          entityId,
          stage: 'upload',
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      } finally {
        try {
          rmSync(downloaded.path, { force: true });
        } catch {
          /* ignore */
        }
      }

      try {
        const primaryImage = sanitizePrimaryImageForRelease({
          url: ref.publicUrl,
          alt: propose.alt!,
          credit: propose.credit!,
          rightsStatus: propose.rightsStatus!,
          objectPath: ref.objectPath,
        });
        if (!primaryImage) {
          throw new Error('primaryImage failed sanitizePrimaryImageForRelease');
        }
        // Patch image only — avoid full-document rewrite (legacy location/redaction quirks).
        await docRef.update({ primaryImage });
        counts.promoted += 1;
        if (counts.promoted % 25 === 0) {
          console.log(`  … promoted ${counts.promoted}`);
        }
      } catch (error) {
        counts.writeFailed += 1;
        failures.push({
          entityId,
          stage: 'write',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      counts.writeFailed += 1;
      failures.push({
        entityId,
        stage: 'unexpected',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log('\n=== Promote counts ===');
  console.log(`candidates:          ${work.length}`);
  console.log(`promoted:            ${counts.promoted}`);
  console.log(`skippedExisting:     ${counts.skippedExisting}`);
  console.log(`missingProjection:   ${counts.missingProjection}`);
  console.log(`downloadFailed:      ${counts.downloadFailed}`);
  console.log(`uploadFailed:        ${counts.uploadFailed}`);
  console.log(`writeFailed:         ${counts.writeFailed}`);

  const failPath = join(
    scriptDir,
    '../fixtures/release-artifacts/commons-media-promote-failures.json',
  );
  if (failures.length > 0) {
    mkdirSync(dirname(failPath), { recursive: true });
    writeFileSync(failPath, JSON.stringify({ releaseId, counts, failures }, null, 2));
    console.log(`Failures written: ${failPath} (${failures.length})`);
  }

  if (counts.promoted === 0 && work.length > 0 && counts.skippedExisting < work.length) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

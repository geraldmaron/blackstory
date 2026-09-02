/**
 * Pin-and-serve Commons primary images (repo-4vuf, WS5 / architecture repo-n7p6.7.1).
 *
 * Turns dry-run-commons-qid-leftover.ts's `auto_propose` output into a pin plan: a
 * 960px Special:FilePath thumbnail URL the reader's browser fetches directly from
 * Wikimedia at view time. Never downloads or stores the original image bytes.
 *
 * Applies the same gates as the dry-run script (DIGNITY_CLASSES + `lynching_` entity-id
 * prefix), re-derived independently rather than trusted from the input file (see
 * scripts/lib/pin-commons-primary-images-plan.ts). Skips `kind: 'place'` rows unless
 * `--allow-places` is passed — the architecture decision (repo-n7p6.7.1) is that places are
 * never auto-photographed.
 *
 * sha1 pinning: the dry-run file does not carry a file's sha1 (its Commons imageinfo fetch
 * requests url|extmetadata only). This script fetches sha1 in a separate metadata step,
 * sequentially, 1 request/second — unless `--sha1-cache=<path>` points at a JSON file of
 * `{ [fileTitle]: sha1 }` already covering every candidate, in which case it fetches nothing.
 *
 * --dry-run (default): writes the plan JSON only.
 * --apply: patches primaryImage onto the active-release Firestore projection for each
 *   planned entity, guarded the same way promote-*.ts scripts are guarded
 *   (APP_FIREBASE_ALLOW_PRODUCTION=1), reusing sanitizePrimaryImageForRelease so a plan row
 *   that fails the publication gate (missing alt/credit/rights) is dropped, not written.
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/pin-commons-primary-images.ts \
 *     --from=.cache/commons-qid-leftover-dry-run.json \
 *     --out=.cache/commons-pin-plan.json
 *
 * Apply (writes; requires credentials — orchestrator-run only, never from this script's tests):
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/pin-commons-primary-images.ts \
 *     --from=.cache/commons-pin-plan.json --apply --release-id=rel_xxx
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  commonsPinThumbnailUrl,
  createCommonsMediaClient,
  sanitizePrimaryImageForRelease,
} from '@repo/domain';
import { firestorePaths } from '../src/index.ts';
import {
  buildPinPlanRow,
  evaluatePinGate,
  type CommonsAutoProposeRow,
  type PinPlanRow,
} from './lib/pin-commons-primary-images-plan.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.APP_FIREBASE_ALLOW_PRODUCTION === '1';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

type DryRunPayload = {
  readonly autoProposeAll?: readonly CommonsAutoProposeRow[];
  readonly autoProposePeople?: readonly CommonsAutoProposeRow[];
  readonly proposes?: readonly CommonsAutoProposeRow[];
};

/**
 * Sequential, polite sha1 fetch — 1 request/second, in the order the plan needs them.
 * Wikimedia asks for descriptive User-Agent + low concurrency; see
 * commons-media-client.ts's WIKIMEDIA_USER_AGENT.
 */
async function fetchSha1sSequentially(
  fileTitles: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const client = createCommonsMediaClient({ batchSize: 1, batchDelayMs: 0 });
  const out = new Map<string, string>();
  for (let i = 0; i < fileTitles.length; i += 1) {
    const fileTitle = fileTitles[i]!;
    const metadata = await client.fetchCommonsImageMetadata([fileTitle]);
    const sha1 = metadata.get(fileTitle)?.sha1;
    if (sha1) out.set(fileTitle, sha1);
    if (i < fileTitles.length - 1) {
      await sleep(1000);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const apply = flag('apply');
  const dryRun = !apply;
  const allowPlaces = flag('allow-places');
  const fromPath = resolve(arg('from') ?? '.cache/commons-qid-leftover-dry-run.json');
  const outPath = resolve(arg('out') ?? '.cache/commons-pin-plan.json');
  const sha1CachePath = arg('sha1-cache');
  const releaseIdArg = arg('release-id');

  if (!existsSync(fromPath)) {
    console.error(`Missing input file: ${fromPath}`);
    process.exit(2);
  }

  const payload = JSON.parse(readFileSync(fromPath, 'utf8')) as DryRunPayload;
  const candidates: readonly CommonsAutoProposeRow[] =
    payload.autoProposeAll ?? payload.autoProposePeople ?? payload.proposes ?? [];

  const gated: { readonly row: CommonsAutoProposeRow }[] = [];
  const held: { readonly entityId: string; readonly reason: string }[] = [];
  for (const row of candidates) {
    const result = evaluatePinGate(row, { allowPlaces });
    if (result.ok) {
      gated.push({ row });
    } else {
      held.push({ entityId: row.entityId, reason: result.reason });
    }
  }

  const sha1Cache: Record<string, string> = sha1CachePath
    ? (JSON.parse(readFileSync(resolve(sha1CachePath), 'utf8')) as Record<string, string>)
    : {};

  const missingSha1Titles = [
    ...new Set(
      gated.map(({ row }) => row.fileTitle!).filter((title) => sha1Cache[title] === undefined),
    ),
  ];
  const fetchedSha1s =
    missingSha1Titles.length > 0
      ? await fetchSha1sSequentially(missingSha1Titles)
      : new Map<string, string>();

  const plan: PinPlanRow[] = [];
  const rightsStatusByEntityId = new Map<string, 'public_domain' | 'licensed' | 'fair_use'>();
  const skippedMissingSha1: string[] = [];
  for (const { row } of gated) {
    const fileTitle = row.fileTitle!;
    const sha1 = sha1Cache[fileTitle] ?? fetchedSha1s.get(fileTitle);
    if (!sha1) {
      skippedMissingSha1.push(row.entityId);
      continue;
    }
    plan.push(
      buildPinPlanRow({
        row,
        thumbUrl: commonsPinThumbnailUrl(fileTitle),
        sha1,
      }),
    );
    if (row.rightsStatus) {
      rightsStatusByEntityId.set(row.entityId, row.rightsStatus);
    }
  }

  const outPayload = {
    generatedAt: new Date().toISOString(),
    source: fromPath,
    allowPlaces,
    candidateCount: candidates.length,
    heldCount: held.length,
    held,
    skippedMissingSha1,
    planCount: plan.length,
    plan,
  };
  writeFileSync(outPath, `${JSON.stringify(outPayload, null, 2)}\n`);
  console.log(
    `Wrote plan: ${outPath} (${plan.length} pinned, ${held.length} held, ${skippedMissingSha1.length} missing sha1)`,
  );

  if (dryRun) {
    console.log('Dry-run only — nothing written to Firestore. Pass --apply to publish.');
    return;
  }

  if (!ALLOW) {
    console.error('Refusing to write: set APP_FIREBASE_ALLOW_PRODUCTION=1 to use --apply');
    process.exit(2);
  }
  const releaseId = releaseIdArg;
  if (!releaseId) {
    console.error('Missing required --release-id= for --apply');
    process.exit(2);
  }

  // Deferred: only imported (and Firebase Admin initialized) once --apply is confirmed, so
  // a --dry-run run never needs Application Default Credentials.
  const { applicationDefault, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  let promoted = 0;
  let skippedExisting = 0;
  let rejectedByGate = 0;
  let missingProjection = 0;
  for (const row of plan) {
    const docPath = firestorePaths.publicEntity(releaseId, row.entityId);
    const docRef = db.doc(docPath);

    const snap = await docRef.get();
    if (!snap.exists) {
      missingProjection += 1;
      continue;
    }
    if (snap.data()?.primaryImage?.url) {
      skippedExisting += 1;
      continue;
    }
    const rightsStatus = rightsStatusByEntityId.get(row.entityId);
    if (!rightsStatus) {
      rejectedByGate += 1;
      continue;
    }
    const primaryImage = sanitizePrimaryImageForRelease({
      url: row.url,
      alt: row.alt,
      credit: row.credit,
      rightsStatus,
      sourceSystem: 'wikimedia_commons',
      fileTitle: row.fileTitle,
      ...(row.sha1 !== undefined ? { sha1: row.sha1 } : {}),
      sourcePageUrl: row.sourcePageUrl,
      ...(row.license !== undefined ? { license: row.license } : {}),
      pinnedAt: new Date().toISOString(),
    });
    if (!primaryImage) {
      rejectedByGate += 1;
      continue;
    }

    await docRef.update({ primaryImage });
    promoted += 1;
  }

  console.log(
    `Applied: promoted=${promoted} skippedExisting=${skippedExisting} rejectedByGate=${rejectedByGate} missingProjection=${missingProjection}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

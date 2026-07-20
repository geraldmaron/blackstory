/**
 * Operator-visible status for the corsair entity fill-out program: one command that
 * answers "where do things stand right now" without SSHing to Corsair or grepping
 * .cache directories by hand. Read-only against Firestore + local overnight-run
 * artifacts (local artifacts only cover the machine this runs on — pass
 * --cache-dir when checking Corsair's .cache remotely via a mounted/synced path).
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/corsair-status-report.ts
 *   node --conditions development --import tsx packages/firebase/scripts/corsair-status-report.ts --json
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const jsonOutput = process.argv.includes('--json');

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}
const db = getFirestore();

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const cacheDirFlagIndex = process.argv.indexOf('--cache-dir');
const overnightCacheDir =
  cacheDirFlagIndex >= 0 && process.argv[cacheDirFlagIndex + 1]
    ? process.argv[cacheDirFlagIndex + 1]!
    : join(repoRoot, '.cache/overnight-enrichment');
const triageCacheDir = join(repoRoot, '.cache/corsair-triage');

async function countBy(collection: string, field: string): Promise<Record<string, number>> {
  const snap = await db.collection(collection).select(field).get();
  const counts: Record<string, number> = {};
  for (const doc of snap.docs) {
    const value = (doc.data()[field] as string) ?? '(none)';
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

async function count(path: string): Promise<number> {
  const snap = await db.collection(path).count().get();
  return snap.data().count;
}

function latestFilesMatching(dir: string, pattern: RegExp, limit = 5): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((entry) => entry.name);
}

type RunSummary = {
  readonly file: string;
  readonly summary: unknown;
};

function readLatestOvernightSummaries(count_ = 3): RunSummary[] {
  return latestFilesMatching(overnightCacheDir, /^summary-.*\.json$/u, count_).map((file) => ({
    file,
    summary: JSON.parse(readFileSync(join(overnightCacheDir, file), 'utf8')),
  }));
}

function readLatestTriageInventory(): unknown | undefined {
  const path = join(triageCacheDir, 'inventory.json');
  if (!existsSync(path)) return undefined;
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    readonly counts?: Record<string, number>;
  };
  return data.counts ?? data;
}

async function main(): Promise<void> {
  const activeReleaseDoc = await db.doc('publicMeta/activeRelease').get();
  const activeRelease = activeReleaseDoc.exists
    ? (activeReleaseDoc.data()?.releaseId as string)
    : undefined;

  const [researchCaseStates, submissionModerationStates, publicEntities, entityRelationships] =
    await Promise.all([
      countBy('researchCases', 'state'),
      countBy('submissionInbox', 'moderationState'),
      activeRelease ? count(`publicReleases/${activeRelease}/entities`) : Promise.resolve(0),
      count('entityRelationships'),
    ]);

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_ID,
    activeRelease: activeRelease ?? '(missing)',
    published: {
      entities: publicEntities,
      entityRelationships,
    },
    researchPipeline: {
      researchCasesByState: researchCaseStates,
      submissionsByModerationState: submissionModerationStates,
      totalCandidatePool:
        Object.values(researchCaseStates).reduce((sum, n) => sum + n, 0) -
        (researchCaseStates.excluded ?? 0) -
        (researchCaseStates.merged ?? 0),
    },
    corsairTriage:
      readLatestTriageInventory() ??
      '(no local triage inventory — run triage-corsair-candidates.ts)',
    overnightRuns: readLatestOvernightSummaries(),
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`BlackStory corsair status — ${report.generatedAt}`);
  console.log(`project: ${PROJECT_ID}   active release: ${report.activeRelease}`);
  console.log('');
  console.log(`Published: ${publicEntities} entities, ${entityRelationships} relationship edges`);
  console.log('');
  console.log('Research pipeline (researchCases by state):');
  for (const [state, n] of Object.entries(researchCaseStates).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${state.padEnd(24)} ${n}`);
  }
  console.log('');
  console.log('Recent overnight enrichment runs (Corsair, local .cache):');
  if (report.overnightRuns.length === 0) {
    console.log(`  none found under ${overnightCacheDir}`);
  } else {
    for (const { file, summary } of report.overnightRuns) {
      console.log(`  ${file}: ${JSON.stringify(summary)}`);
    }
  }
  console.log('');
  console.log('Corsair triage inventory (local .cache):');
  console.log(`  ${JSON.stringify(report.corsairTriage)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

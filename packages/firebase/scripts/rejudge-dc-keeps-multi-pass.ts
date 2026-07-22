/**
 * Multi-model rejudge for unpromoted DC enrichment keeps: runs sequential enrichment passes
 * (GLM → Qwen3 → Qwen3.5), merges best packet per subject, auto-promotes clears, and optionally
 * publishes to Firestore/Postgres via publish-national-catalog.ts.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpsPostgresPool } from '../../data-access/src/postgres/pool.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const cacheDir = join(repoRoot, '.cache/dc-enrichment');
const wrapper = join(repoRoot, 'packages/firebase/scripts/run-enrichment-with-local-env.sh');

type SubjectMeta = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
};

type EnrichmentItem = {
  readonly packet: {
    readonly subjectId: string;
    readonly subjectTitle?: string;
    readonly decision: string;
    readonly confidence: number;
    readonly validationIssues: readonly string[];
  };
  readonly error?: string;
};

type EnrichmentRun = {
  readonly items: readonly EnrichmentItem[];
  readonly keepCount?: number;
  readonly errorCount?: number;
};

const PASSES: readonly { readonly id: string; readonly model: string; readonly concurrency: number }[] =
  [
    { id: 'pass1-glm', model: 'z-ai/glm-4.5-air', concurrency: 4 },
    { id: 'pass2-qwen3', model: 'qwen/qwen3-32b', concurrency: 4 },
    { id: 'pass3-qwen35', model: 'qwen/qwen3.5-122b-a10b', concurrency: 2 },
  ];

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadSubjects(): { readonly subjects: readonly SubjectMeta[] } {
  const path = join(cacheDir, 'rejudge-keeps-subjects.json');
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}; build non-promoted keep subjects first.`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as { subjects: readonly SubjectMeta[] };
}

function loadPromotedIds(): Set<string> {
  const catalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
  const promoted = new Set<string>();
  if (!existsSync(catalogDir)) return promoted;
  for (const file of readdirSync(catalogDir)) {
    if (!file.startsWith('auto-promoted-') || !file.endsWith('.json')) continue;
    const entries = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as readonly {
      readonly id: string;
    }[];
    entries.forEach((entry) => promoted.add(entry.id));
  }
  return promoted;
}

function scoreItem(item: EnrichmentItem): number {
  if (item.error) return -1;
  const { packet } = item;
  if (packet.decision === 'keep') return 100 + packet.confidence * 10 - packet.validationIssues.length;
  if (packet.decision === 'needs_evidence') return 10 + packet.confidence;
  return 0;
}

function mergeRuns(runs: readonly { readonly passId: string; readonly run: EnrichmentRun }[]): {
  readonly items: EnrichmentItem[];
  readonly byPass: Record<string, number>;
} {
  const bestBySubject = new Map<string, EnrichmentItem>();
  const byPass: Record<string, number> = {};
  for (const { passId, run } of runs) {
    let wins = 0;
    for (const item of run.items) {
      const prev = bestBySubject.get(item.packet.subjectId);
      if (!prev || scoreItem(item) > scoreItem(prev)) {
        bestBySubject.set(item.packet.subjectId, item);
        wins += 1;
      }
    }
    byPass[passId] = wins;
  }
  return { items: [...bestBySubject.values()], byPass };
}

function runEnrichmentPass(input: {
  readonly passId: string;
  readonly model: string;
  readonly concurrency: number;
  readonly subjectsPath: string;
  readonly sessionSuffix: string;
}): string {
  const outPath = join(cacheDir, `rejudge-${input.passId}-enrichment-run.json`);
  const cmd = [
    wrapper,
    'enrichment-run',
    '--subjects',
    input.subjectsPath,
    '--provider',
    'openrouter',
    '--model',
    input.model,
    '--concurrency',
    String(input.concurrency),
    '--operator-id',
    'cursor-rejudge-multi',
    '--session-id',
    `dc-rejudge-${input.passId}-${input.sessionSuffix}`,
    '--identity-source',
    'cli',
    '--output',
    outPath,
  ];
  console.error(`[${input.passId}] model=${input.model} subjects=${input.subjectsPath}`);
  execSync(cmd.join(' '), {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      OPS_DATA_SOURCE: process.env.OPS_DATA_SOURCE ?? 'postgres',
      RESEARCH_PROFILE_ID: process.env.RESEARCH_PROFILE_ID ?? 'black-history',
      RESEARCH_PROFILE_VERSION: process.env.RESEARCH_PROFILE_VERSION ?? '1.0.0',
      RESEARCH_SCHEMA_VERSION: process.env.RESEARCH_SCHEMA_VERSION ?? '1.0.0',
      DATABASE_SSL: process.env.DATABASE_SSL ?? 'true',
    },
  });
  return outPath;
}

function writeSubjectsSubset(
  subjects: readonly SubjectMeta[],
  fileName: string,
): string {
  const outPath = join(cacheDir, fileName);
  writeFileSync(outPath, `${JSON.stringify({ subjects }, null, 2)}\n`);
  return outPath;
}

function loadAutoPromoteReport(stamp: string): {
  readonly promoted: number;
  readonly held: number;
  readonly promotedIds: readonly string[];
} {
  const reportPath = join(repoRoot, '.cache/auto-promotion', `report-${stamp}.json`);
  if (!existsSync(reportPath)) return { promoted: 0, held: 0, promotedIds: [] };
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
    readonly promoted: number;
    readonly held: number;
    readonly heldReasons: readonly { readonly subjectId: string }[];
  };
  const fixturePath = join(
    repoRoot,
    'packages/firebase/fixtures/national-catalog',
    `auto-promoted-${stamp}.json`,
  );
  const promotedIds = existsSync(fixturePath)
    ? (JSON.parse(readFileSync(fixturePath, 'utf8')) as readonly { readonly id: string }[]).map(
        (entry) => entry.id,
      )
    : [];
  return { promoted: report.promoted, held: report.held, promotedIds };
}

function subjectsNotPromoted(
  merged: EnrichmentRun,
  promotedIds: ReadonlySet<string>,
): readonly SubjectMeta[] {
  const all = loadSubjects().subjects;
  const byId = new Map(all.map((subject) => [subject.subjectId, subject]));
  return merged.items
    .filter((item) => !promotedIds.has(item.packet.subjectId))
    .map((item) => byId.get(item.packet.subjectId))
    .filter((subject): subject is SubjectMeta => subject !== undefined);
}

function borderlineSubjects(
  merged: EnrichmentRun,
  promotedIds: ReadonlySet<string>,
): readonly SubjectMeta[] {
  const all = loadSubjects().subjects;
  const byId = new Map(all.map((subject) => [subject.subjectId, subject]));
  return merged.items
    .filter(
      (item) =>
        !promotedIds.has(item.packet.subjectId) &&
        !item.error &&
        item.packet.decision === 'keep' &&
        item.packet.confidence >= 0.7,
    )
    .map((item) => byId.get(item.packet.subjectId))
    .filter((subject): subject is SubjectMeta => subject !== undefined);
}

async function countBbPublic(): Promise<number> {
  const pool = getOpsPostgresPool({ ...process.env, DATABASE_SSL: 'true' });
  const result = await pool.query('SELECT COUNT(*)::int AS n FROM bb_public.release_entities');
  await pool.end();
  return result.rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  const applyPublish = process.argv.includes('--apply-publish');
  const skipEnrichment = process.argv.includes('--skip-enrichment');
  const stamp = readArgFlag('--stamp') ?? 'dc-rejudge-multi';
  const sessionSuffix = String(Date.now());
  mkdirSync(cacheDir, { recursive: true });

  const bbPublicBefore = await countBbPublic();
  const alreadyPromoted = loadPromotedIds();
  const allSubjects = loadSubjects();
  console.log(
    JSON.stringify(
      {
        subjectCount: allSubjects.subjects.length,
        alreadyPromotedInFixtures: alreadyPromoted.size,
        bbPublicBefore,
      },
      null,
      2,
    ),
  );

  const completedRuns: Array<{ passId: string; run: EnrichmentRun; model: string }> = [];

  if (!skipEnrichment) {
    const pass1Path = runEnrichmentPass({
      passId: PASSES[0]!.id,
      model: PASSES[0]!.model,
      concurrency: PASSES[0]!.concurrency,
      subjectsPath: join(cacheDir, 'rejudge-keeps-subjects.json'),
      sessionSuffix,
    });
    completedRuns.push({
      passId: PASSES[0]!.id,
      model: PASSES[0]!.model,
      run: JSON.parse(readFileSync(pass1Path, 'utf8')) as EnrichmentRun,
    });

    let merged = mergeRuns(completedRuns);
    writeFileSync(
      join(cacheDir, 'rejudge-merged-enrichment-run.json'),
      `${JSON.stringify({ kind: 'enrichment.run.v1', items: merged.items }, null, 2)}\n`,
    );

    execSync(
      [
        'node --conditions development --import tsx',
        join(repoRoot, 'packages/firebase/scripts/auto-promote-corsair-keeps.ts'),
        '--run',
        join(cacheDir, 'rejudge-merged-enrichment-run.json'),
        '--subjects',
        join(cacheDir, 'rejudge-keeps-subjects.json'),
        '--stamp',
        `${stamp}-after-pass1`,
      ].join(' '),
      { cwd: repoRoot, stdio: 'inherit' },
    );
    const pass1Promoted = new Set(loadAutoPromoteReport(`${stamp}-after-pass1`).promotedIds);

    const pass2Subjects = writeSubjectsSubset(
      subjectsNotPromoted(
        { items: merged.items },
        new Set([...alreadyPromoted, ...pass1Promoted]),
      ),
      'rejudge-pass2-subjects.json',
    );
    if (JSON.parse(readFileSync(pass2Subjects, 'utf8')).subjects.length > 0) {
      const pass2Path = runEnrichmentPass({
        passId: PASSES[1]!.id,
        model: PASSES[1]!.model,
        concurrency: PASSES[1]!.concurrency,
        subjectsPath: pass2Subjects,
        sessionSuffix,
      });
      completedRuns.push({
        passId: PASSES[1]!.id,
        model: PASSES[1]!.model,
        run: JSON.parse(readFileSync(pass2Path, 'utf8')) as EnrichmentRun,
      });
      merged = mergeRuns(completedRuns);
      writeFileSync(
        join(cacheDir, 'rejudge-merged-enrichment-run.json'),
        `${JSON.stringify({ kind: 'enrichment.run.v1', items: merged.items }, null, 2)}\n`,
      );
    }

    execSync(
      [
        'node --conditions development --import tsx',
        join(repoRoot, 'packages/firebase/scripts/auto-promote-corsair-keeps.ts'),
        '--run',
        join(cacheDir, 'rejudge-merged-enrichment-run.json'),
        '--subjects',
        join(cacheDir, 'rejudge-keeps-subjects.json'),
        '--stamp',
        `${stamp}-after-pass2`,
      ].join(' '),
      { cwd: repoRoot, stdio: 'inherit' },
    );
    const pass2Promoted = new Set(loadAutoPromoteReport(`${stamp}-after-pass2`).promotedIds);

    const pass3Subjects = writeSubjectsSubset(
      borderlineSubjects(
        { items: merged.items },
        new Set([...alreadyPromoted, ...pass2Promoted]),
      ),
      'rejudge-pass3-subjects.json',
    );
    if (JSON.parse(readFileSync(pass3Subjects, 'utf8')).subjects.length > 0) {
      const pass3Path = runEnrichmentPass({
        passId: PASSES[2]!.id,
        model: PASSES[2]!.model,
        concurrency: PASSES[2]!.concurrency,
        subjectsPath: pass3Subjects,
        sessionSuffix,
      });
      completedRuns.push({
        passId: PASSES[2]!.id,
        model: PASSES[2]!.model,
        run: JSON.parse(readFileSync(pass3Path, 'utf8')) as EnrichmentRun,
      });
      merged = mergeRuns(completedRuns);
      writeFileSync(
        join(cacheDir, 'rejudge-merged-enrichment-run.json'),
        `${JSON.stringify({ kind: 'enrichment.run.v1', items: merged.items }, null, 2)}\n`,
      );
    }
  }

  const mergedRun = JSON.parse(
    readFileSync(join(cacheDir, 'rejudge-merged-enrichment-run.json'), 'utf8'),
  ) as EnrichmentRun;
  const mergedStats = {
    keep: mergedRun.items.filter((i) => !i.error && i.packet.decision === 'keep').length,
    needsEvidence: mergedRun.items.filter((i) => !i.error && i.packet.decision === 'needs_evidence')
      .length,
    errors: mergedRun.items.filter((i) => i.error).length,
  };

  execSync(
    [
      'node --conditions development --import tsx',
      join(repoRoot, 'packages/firebase/scripts/auto-promote-corsair-keeps.ts'),
      '--run',
      join(cacheDir, 'rejudge-merged-enrichment-run.json'),
      '--subjects',
      join(cacheDir, 'rejudge-keeps-subjects.json'),
      '--stamp',
      stamp,
    ].join(' '),
    { cwd: repoRoot, stdio: 'inherit' },
  );
  const finalPromote = loadAutoPromoteReport(stamp);
  const newlyPromoted = finalPromote.promotedIds.filter((id) => !alreadyPromoted.has(id));

  if (newlyPromoted.length > 0) {
    execSync('DRY_RUN=1 APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts', {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    if (applyPublish) {
      execSync('APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts', {
        cwd: repoRoot,
        stdio: 'inherit',
      });
      execSync(
        'pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --collection=publicReleases',
        { cwd: repoRoot, stdio: 'inherit', env: { ...process.env, APP_FIREBASE_ALLOW_PRODUCTION: '1', DATABASE_SSL: 'true' } },
      );
    }
  }

  const bbPublicAfter = await countBbPublic();
  const summary = {
    modelsPerPass: completedRuns.map((run) => ({ passId: run.passId, model: run.model })),
    mergedStats,
    newlyPromotedIds: newlyPromoted,
    newlyPromotedCount: newlyPromoted.length,
    heldCount: finalPromote.held,
    bbPublicBefore,
    bbPublicAfter,
    bbPublicDelta: bbPublicAfter - bbPublicBefore,
    applyPublish,
  };
  writeFileSync(join(cacheDir, 'rejudge-multi-pass-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

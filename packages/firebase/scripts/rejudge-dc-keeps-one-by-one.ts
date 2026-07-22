/**
 * DC keep rejudge with live progress for owner tail -f monitoring.
 * Primary qwen3-32b (concurrency 4); same-model retry once on JSON/error;
 * 122b escalation only for keep conf≥0.9 with thin-margin claim-confidence miss.
 * Promotes eligible keeps in waves of 5 to bb_public.
 */
import { execSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReleaseEntityArtifacts,
  type ReleaseSourceClaim,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { getOpsPostgresPool } from '../../data-access/src/postgres/pool.js';
import { computeClaimConfidence, type SourceForConfidence } from './lib/confidence.ts';
import { normalizeEnrichmentDrafts } from './lib/normalize-enrichment-drafts.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const cacheDir = join(repoRoot, '.cache/dc-enrichment');
const oneDir = join(cacheDir, 'rejudge-one');
const progressPath = join(cacheDir, 'rejudge-progress.ndjson');
const statusPath = join(cacheDir, 'rejudge-status.md');
const runPath = join(cacheDir, 'rejudge-one-by-one-run.json');
const wrapper = join(repoRoot, 'packages/firebase/scripts/run-enrichment-with-local-env.sh');

const AUTO_PROMOTE_CONFIDENCE_FLOOR = 0.8;
const ITEM_TIMEOUT_MS = 90_000;
const PROMOTE_WAVE_SIZE = 5;
const CONCURRENCY = 4;
const PRIMARY_MODEL = 'qwen/qwen3-32b';
/** Same-model re-run on JSON/error — data shows 72b (31% JSON fail) and GLM (78%) worse than 32b (4.7%). */
const RETRY_MODEL = PRIMARY_MODEL;
const ESCALATION_MODEL = 'qwen/qwen3.5-122b-a10b';
const CLAIM_CONFIDENCE_THIN_MARGIN = 0.1;
const PASS_LABEL = 'one-by-one';

const MODEL_POLICY = {
  primary: PRIMARY_MODEL,
  retryOnJsonFail: `${PRIMARY_MODEL} (same-model re-run, attempt 2)`,
  escalationRare: `${ESCALATION_MODEL} (keep conf≥0.9, claim conf within ${CLAIM_CONFIDENCE_THIN_MARGIN} of threshold only)`,
  concurrency: CONCURRENCY,
  avoided: ['qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-7b-instruct', 'z-ai/glm-4.5-air as primary/retry'],
  dataSources: '.cache/dc-enrichment/rejudge-pass{1,2,3}*.progress.ndjson, rejudge-retry*.progress.ndjson, rejudge-progress.ndjson',
  rationale:
    'Pass2 qwen3-32b: 91.5% keep, 4.7% JSON errors, ~$0.08/1M — best reliability/cost. GLM pass1: 78.3% JSON fail. 72b retry: 31.2% JSON fail on 77 subjects. Zero promote-eligible across all models (claim-confidence gate); optimize for valid keeps + JSON reliability. No 2.5 line per owner policy.',
} as const;

type SubjectMeta = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision?: string;
  readonly locationLabel?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly corroboratingSourceUrl?: string;
  readonly existingSummary?: string;
  readonly existingContext?: string;
  readonly sourceSnippets?: readonly string[];
};

type EnrichmentItem = {
  readonly packet: {
    readonly subjectId: string;
    readonly subjectTitle?: string;
    readonly decision: string;
    readonly confidence: number;
    readonly validationIssues: readonly string[];
    readonly drafts: {
      readonly claims?: readonly {
        readonly predicate?: string;
        readonly object?: string;
        readonly confidenceLevel?: string;
        readonly citationSource?: string;
        readonly citationHref?: string;
        readonly citationLabel?: string;
      }[];
      readonly publicSummary?: string;
      readonly historicalContext?: string;
      readonly topicIds?: readonly string[];
      readonly eraBuckets?: readonly string[];
      readonly keywords?: readonly string[];
    };
  };
  readonly error?: string;
};

type ProgressLine = {
  readonly id: string;
  readonly displayName: string;
  readonly model: string;
  readonly decision: string;
  readonly confidence: number | null;
  readonly promoteEligible: boolean;
  readonly pass: string;
  readonly promoteReason?: string;
  readonly error?: string;
  readonly at: string;
  readonly index?: number;
  readonly total?: number;
};

type Totals = {
  processed: number;
  keeps: number;
  needsEvidence: number;
  errors: number;
  promoteEligible: number;
  promoted: number;
  lastFive: ProgressLine[];
  sessionProcessed: number;
};

type QueueTask = {
  readonly id: string;
  readonly index: number;
  readonly subject: SubjectMeta;
};

let writeLock: Promise<void> = Promise.resolve();

async function withWriteLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const prior = writeLock;
  let release!: () => void;
  writeLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  try {
    return await fn();
  } finally {
    release();
  }
}

function loadSubjectsById(): Map<string, SubjectMeta> {
  const path = join(cacheDir, 'rejudge-keeps-subjects-augmented.json');
  const fallback = join(cacheDir, 'rejudge-keeps-subjects.json');
  const file = existsSync(path) ? path : fallback;
  const data = JSON.parse(readFileSync(file, 'utf8')) as { subjects: readonly SubjectMeta[] };
  return new Map(data.subjects.map((subject) => [subject.subjectId, subject]));
}

function loadQueue(): readonly string[] {
  return (JSON.parse(readFileSync(join(cacheDir, 'rejudge-queue.json'), 'utf8')) as { ids: string[] })
    .ids;
}

function loadOneByOneProcessedIds(): Set<string> {
  if (!existsSync(progressPath)) return new Set();
  const ids = new Set<string>();
  for (const line of readFileSync(progressPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as ProgressLine & { index?: number };
      if (parsed.pass === PASS_LABEL || parsed.index !== undefined) ids.add(parsed.id);
    } catch {
      // skip malformed
    }
  }
  return ids;
}

function loadRunItems(): EnrichmentItem[] {
  if (!existsSync(runPath)) return [];
  return (JSON.parse(readFileSync(runPath, 'utf8')) as { items: EnrichmentItem[] }).items;
}

function saveRunItems(items: readonly EnrichmentItem[]): void {
  writeFileSync(runPath, `${JSON.stringify({ kind: 'enrichment.run.v1', items }, null, 2)}\n`);
}

function claimConfidenceBlockers(
  item: EnrichmentItem,
  subject: SubjectMeta | undefined,
): readonly { index: number; score: number; threshold: number }[] {
  if (item.error || !subject) return [];
  const { packet } = item;
  if (packet.decision !== 'keep') return [];
  const claims = packet.drafts.claims ?? [];
  const blockers: { index: number; score: number; threshold: number }[] = [];
  for (const [index, claim] of claims.entries()) {
    if (!claim.citationHref) continue;
    const sources: SourceForConfidence[] = [{ url: claim.citationHref, textContainsSubjectName: true }];
    if (subject.corroboratingSourceUrl && subject.corroboratingSourceUrl !== claim.citationHref) {
      sources.push({ url: subject.corroboratingSourceUrl, textContainsSubjectName: true });
    }
    const result = computeClaimConfidence(`${packet.subjectId}-claim-${index}`, sources);
    if (!result.passesPublishThreshold) {
      blockers.push({ index, score: result.score, threshold: result.threshold });
    }
  }
  return blockers;
}

function shouldEscalateTo122b(item: EnrichmentItem, subject: SubjectMeta | undefined): boolean {
  if (item.error) return false;
  const { packet } = item;
  if (packet.decision !== 'keep' || packet.confidence < 0.9) return false;
  if (packet.validationIssues.length > 0) return false;
  if (!subject || subject.kind === 'person') return false;
  const claims = packet.drafts.claims ?? [];
  if (claims.length === 0) return false;
  if (!subject.jurisdictionLabel || !subject.locationLabel || !subject.locationPrecision) return false;

  const blockers = claimConfidenceBlockers(item, subject);
  if (blockers.length === 0) return false;

  for (const claim of claims) {
    if (!claim.citationHref) return false;
  }

  const promo = evaluatePromoteEligible(item, subject);
  if (promo.eligible) return false;
  if (!/^claims\[\d+\] conf /u.test(promo.reason)) return false;

  return blockers.every(
    (b) => b.score >= b.threshold - CLAIM_CONFIDENCE_THIN_MARGIN && b.score < b.threshold,
  );
}

function evaluatePromoteEligible(
  item: EnrichmentItem,
  subject: SubjectMeta | undefined,
): { eligible: boolean; reason: string } {
  if (item.error) return { eligible: false, reason: item.error };
  const { packet } = item;
  if (packet.decision !== 'keep') return { eligible: false, reason: `decision=${packet.decision}` };
  if (packet.confidence < AUTO_PROMOTE_CONFIDENCE_FLOOR) {
    return { eligible: false, reason: `confidence ${packet.confidence} < ${AUTO_PROMOTE_CONFIDENCE_FLOOR}` };
  }
  if (packet.validationIssues.length > 0) {
    return { eligible: false, reason: `validation: ${packet.validationIssues.join('; ')}` };
  }
  if (!subject) return { eligible: false, reason: 'no subject metadata' };
  if (subject.kind === 'person') return { eligible: false, reason: 'person privacy review' };
  const claims = packet.drafts.claims ?? [];
  if (claims.length === 0) return { eligible: false, reason: 'no claims' };
  if (!subject.jurisdictionLabel || !subject.locationLabel || !subject.locationPrecision) {
    return { eligible: false, reason: 'missing location fields' };
  }
  for (const [index, claim] of claims.entries()) {
    if (!claim.citationHref) return { eligible: false, reason: `claims[${index}] no href` };
    const sources: SourceForConfidence[] = [{ url: claim.citationHref, textContainsSubjectName: true }];
    if (subject.corroboratingSourceUrl && subject.corroboratingSourceUrl !== claim.citationHref) {
      sources.push({ url: subject.corroboratingSourceUrl, textContainsSubjectName: true });
    }
    const result = computeClaimConfidence(`${packet.subjectId}-claim-${index}`, sources);
    if (!result.passesPublishThreshold) {
      return {
        eligible: false,
        reason: `claims[${index}] conf ${result.score} < ${result.threshold}`,
      };
    }
  }
  const releaseClaims: ReleaseSourceClaim[] = claims.map((claim) => ({
    predicate: claim.predicate ?? 'documented_site',
    object: claim.object ?? '',
    confidenceLevel:
      claim.confidenceLevel === 'high' || claim.confidenceLevel === 'medium' || claim.confidenceLevel === 'low'
        ? claim.confidenceLevel
        : 'medium',
    citationSource: claim.citationSource ?? new URL(claim.citationHref ?? 'https://unknown').hostname,
    citationHref: claim.citationHref,
    citationLabel: claim.citationLabel ?? claim.citationSource ?? 'Source',
  }));
  const normalizedDrafts = normalizeEnrichmentDrafts(packet.drafts);
  const entry: ReleaseSourceEntity = {
    id: packet.subjectId,
    kind: subject.kind ?? 'place',
    displayName: packet.subjectTitle ?? subject.title,
    summary: normalizedDrafts.publicSummary ?? '',
    ...(normalizedDrafts.eraBuckets && normalizedDrafts.eraBuckets.length > 0
      ? { eraBuckets: normalizedDrafts.eraBuckets }
      : {}),
    ...(normalizedDrafts.topicIds && normalizedDrafts.topicIds.length > 0
      ? { topicTags: normalizedDrafts.topicIds, topicIds: normalizedDrafts.topicIds }
      : {}),
    mentionedEntityIds: [],
    ...(packet.drafts.keywords ? { keywords: packet.drafts.keywords } : {}),
    jurisdictionLabel: subject.jurisdictionLabel,
    locationPrecision: subject.locationPrecision,
    locationLabel: subject.locationLabel,
    lat: subject.lat ?? 0,
    lng: subject.lng ?? 0,
    claims: releaseClaims,
    ...(packet.drafts.historicalContext ? { historicalContext: packet.drafts.historicalContext } : {}),
  };
  const build = buildReleaseEntityArtifacts(entry, {
    releaseId: 'auto-promotion-preview',
    generatedAt: new Date().toISOString(),
  });
  if (!build.ok) return { eligible: false, reason: `${build.reason}: ${build.message}` };
  return { eligible: true, reason: 'clears auto-promote bar' };
}

function runOneEnrichment(subject: SubjectMeta, model: string, sessionId: string): Promise<EnrichmentItem> {
  mkdirSync(oneDir, { recursive: true });
  const subjectFile = join(oneDir, `${subject.subjectId}.json`);
  const outFile = join(oneDir, `${subject.subjectId}-${model.replace(/\//g, '-')}-run.json`);
  writeFileSync(subjectFile, `${JSON.stringify({ subjects: [subject] }, null, 2)}\n`);
  if (existsSync(outFile)) {
    try {
      execSync(`rm -f ${JSON.stringify(outFile)}`, { cwd: repoRoot });
    } catch {
      // ignore
    }
  }
  const cmd = [
    wrapper,
    'enrichment-run',
    '--subjects',
    subjectFile,
    '--provider',
    'openrouter',
    '--model',
    model,
    '--concurrency',
    '1',
    '--operator-id',
    'cursor-rejudge-one',
    '--session-id',
    sessionId,
    '--identity-source',
    'cli',
    '--output',
    outFile,
  ].join(' ');

  return new Promise((resolve) => {
    const child = spawn(cmd, {
      cwd: repoRoot,
      shell: true,
      env: {
        ...process.env,
        OPS_DATA_SOURCE: process.env.OPS_DATA_SOURCE ?? 'postgres',
        DATABASE_SSL: process.env.DATABASE_SSL ?? 'true',
        RESEARCH_PROFILE_ID: process.env.RESEARCH_PROFILE_ID ?? 'black-history',
        RESEARCH_PROFILE_VERSION: process.env.RESEARCH_PROFILE_VERSION ?? '1.0.0',
        RESEARCH_SCHEMA_VERSION: process.env.RESEARCH_SCHEMA_VERSION ?? '1.0.0',
      },
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, ITEM_TIMEOUT_MS);
    child.on('close', () => {
      clearTimeout(timer);
      if (!existsSync(outFile)) {
        resolve({
          packet: {
            subjectId: subject.subjectId,
            subjectTitle: subject.title,
            decision: 'needs_evidence',
            confidence: 0,
            validationIssues: [],
            drafts: {},
          },
          error: stderr.slice(0, 200) || 'no output file',
        });
        return;
      }
      const run = JSON.parse(readFileSync(outFile, 'utf8')) as { items: EnrichmentItem[] };
      resolve(
        run.items[0] ?? {
          packet: {
            subjectId: subject.subjectId,
            subjectTitle: subject.title,
            decision: 'needs_evidence',
            confidence: 0,
            validationIssues: [],
            drafts: {},
          },
          error: 'empty items',
        },
      );
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        packet: {
          subjectId: subject.subjectId,
          subjectTitle: subject.title,
          decision: 'needs_evidence',
          confidence: 0,
          validationIssues: [],
          drafts: {},
        },
        error: error.message,
      });
    });
  });
}

function hadJsonFailure(item: EnrichmentItem): boolean {
  if (item.error) {
    return /json|JSON|timeout|timed out|empty completion|ETIMEDOUT|SIGTERM|no output file/i.test(item.error);
  }
  return item.packet.validationIssues.some((issue) => issue.includes('completion_error'));
}

async function judgeSubject(
  subject: SubjectMeta,
  index: number,
  sessionId: string,
): Promise<{ item: EnrichmentItem; model: string }> {
  let item = await runOneEnrichment(subject, PRIMARY_MODEL, `${sessionId}-32b`);
  let model = PRIMARY_MODEL;

  if (hadJsonFailure(item)) {
    console.error(`[${index}] ${subject.subjectId} ${PRIMARY_MODEL} JSON fail — same-model retry`);
    item = await runOneEnrichment(subject, RETRY_MODEL, `${sessionId}-32b-retry`);
    model = `${RETRY_MODEL} (retry)`;
  }

  if (shouldEscalateTo122b(item, subject)) {
    const blockers = claimConfidenceBlockers(item, subject);
    console.error(
      `[${index}] ${subject.subjectId} thin-margin claim conf (${blockers.map((b) => `${b.score}/${b.threshold}`).join(', ')}) — escalate ${ESCALATION_MODEL}`,
    );
    const escalated = await runOneEnrichment(subject, ESCALATION_MODEL, `${sessionId}-122b-escalation`);
    if (!hadJsonFailure(escalated)) {
      item = escalated;
      model = ESCALATION_MODEL;
    }
  }

  return { item, model };
}

function appendProgress(line: ProgressLine, totals: Totals, queueLength: number): void {
  appendFileSync(progressPath, `${JSON.stringify(line)}\n`);
  totals.lastFive = [...totals.lastFive, line].slice(-5);
  const md = `# DC keep rejudge — live status

Updated: ${line.at}

**Watch progress:** \`tail -f .cache/dc-enrichment/rejudge-progress.ndjson\`

## Model policy (speed/cost)

| Setting | Value |
|---|---|
| Primary | \`${MODEL_POLICY.primary}\` |
| Retry (JSON/error only) | \`${MODEL_POLICY.retryOnJsonFail}\` |
| Rare escalation | \`${MODEL_POLICY.escalationRare}\` |
| Concurrency | ${MODEL_POLICY.concurrency} |
| Avoided | ${MODEL_POLICY.avoided.join('; ')} |

${MODEL_POLICY.rationale}

Analysis: \`.cache/dc-enrichment/rejudge-model-efficiency-analysis.json\`

## Totals (${PASS_LABEL} ${totals.processed}/${queueLength})

| Metric | Count |
|---|---:|
| Processed (cumulative) | ${totals.processed} |
| Processed (this session) | ${totals.sessionProcessed} |
| Keeps (this session) | ${totals.keeps} |
| Needs evidence (this session) | ${totals.needsEvidence} |
| Errors (this session) | ${totals.errors} |
| Promote eligible (this session) | ${totals.promoteEligible} |
| Promoted to bb_public | ${totals.promoted} |

## Last 5

${totals.lastFive
  .map(
    (row) =>
      `- \`${row.id}\` **${row.displayName}** → ${row.decision} conf=${row.confidence ?? 'n/a'} model=\`${row.model}\`${row.promoteEligible ? ' ✅ eligible' : ''}${row.error ? ` err=${row.error.slice(0, 80)}` : ''}`,
  )
  .join('\n')}
`;
  writeFileSync(statusPath, md);
  const summary = `[${PASS_LABEL} ${totals.processed}/${queueLength}] ${line.id} ${line.displayName} → ${line.decision} conf=${line.confidence} model=${line.model} promote=${line.promoteEligible}${line.error ? ` ERR=${line.error.slice(0, 60)}` : ''}`;
  console.log(summary);
}

async function countBbPublic(): Promise<number> {
  const pool = getOpsPostgresPool({ ...process.env, DATABASE_SSL: 'true' });
  const result = await pool.query('SELECT COUNT(*)::int AS n FROM bb_public.release_entities');
  await pool.end();
  return result.rows[0]?.n ?? 0;
}

function loadAlreadyPromotedIds(): Set<string> {
  const catalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
  const ids = new Set<string>();
  if (!existsSync(catalogDir)) return ids;
  for (const file of readdirSync(catalogDir)) {
    if (!file.startsWith('auto-promoted-') || !file.endsWith('.json')) continue;
    for (const entry of JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as readonly {
      id: string;
    }[]) {
      ids.add(entry.id);
    }
  }
  return ids;
}

function flushPromoteWave(
  waveItems: readonly EnrichmentItem[],
  waveNum: number,
): readonly string[] {
  if (waveItems.length === 0) return [];
  const stamp = `dc-rejudge-wave-${waveNum}-${Date.now()}`;
  const waveRun = join(cacheDir, `rejudge-wave-${waveNum}-run.json`);
  const subjectsFile = join(cacheDir, 'rejudge-keeps-subjects-augmented.json');
  writeFileSync(waveRun, `${JSON.stringify({ kind: 'enrichment.run.v1', items: waveItems }, null, 2)}\n`);
  execSync(
    [
      'node --conditions development --import tsx',
      join(repoRoot, 'packages/firebase/scripts/auto-promote-corsair-keeps.ts'),
      '--run',
      waveRun,
      '--subjects',
      subjectsFile,
      '--stamp',
      stamp,
    ].join(' '),
    { cwd: repoRoot, stdio: 'inherit' },
  );
  execSync('DRY_RUN=1 APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  execSync('APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  execSync(
    'pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --collection=publicReleases',
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, APP_FIREBASE_ALLOW_PRODUCTION: '1', DATABASE_SSL: 'true' },
    },
  );
  const fixturePath = join(
    repoRoot,
    'packages/firebase/fixtures/national-catalog',
    `auto-promoted-${stamp}.json`,
  );
  if (!existsSync(fixturePath)) return [];
  return (JSON.parse(readFileSync(fixturePath, 'utf8')) as readonly { id: string }[]).map((e) => e.id);
}

async function runPool(
  tasks: readonly QueueTask[],
  queueLength: number,
  sessionId: string,
  totals: Totals,
  items: EnrichmentItem[],
  pendingEligible: EnrichmentItem[],
  waveNumRef: { value: number },
): Promise<void> {
  let nextTask = 0;

  async function worker(): Promise<void> {
    while (true) {
      const taskIndex = nextTask;
      nextTask += 1;
      if (taskIndex >= tasks.length) return;
      const task = tasks[taskIndex]!;
      const { id, index, subject } = task;

      console.error(`\n=== Processing ${index}/${queueLength}: ${id} (${subject.title}) ===`);
      const { item, model } = await judgeSubject(subject, index, sessionId);
      const promo = evaluatePromoteEligible(item, subject);

      await withWriteLock(async () => {
        totals.processed += 1;
        totals.sessionProcessed += 1;
        if (item.error) totals.errors += 1;
        else if (item.packet.decision === 'keep') totals.keeps += 1;
        else totals.needsEvidence += 1;
        if (promo.eligible) {
          totals.promoteEligible += 1;
          pendingEligible.push(item);
        }

        items.push(item);
        saveRunItems(items);

        const line: ProgressLine = {
          id,
          displayName: subject.title,
          model,
          decision: item.error ? 'error' : item.packet.decision,
          confidence: item.error ? null : item.packet.confidence,
          promoteEligible: promo.eligible,
          pass: PASS_LABEL,
          promoteReason: promo.reason,
          ...(item.error ? { error: item.error } : {}),
          at: new Date().toISOString(),
          index,
          total: queueLength,
        };
        appendProgress(line, totals, queueLength);

        if (pendingEligible.length >= PROMOTE_WAVE_SIZE) {
          waveNumRef.value += 1;
          const wave = pendingEligible.splice(0, PROMOTE_WAVE_SIZE);
          console.error(
            `\n*** PROMOTE WAVE ${waveNumRef.value}: ${wave.map((w) => w.packet.subjectId).join(', ')} ***`,
          );
          const promotedIds = flushPromoteWave(wave, waveNumRef.value);
          totals.promoted += promotedIds.length;
          console.error(`promoted to bb_public: ${promotedIds.join(', ') || '(none)'}`);
        }
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()));
}

async function main(): Promise<void> {
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(oneDir, { recursive: true });
  const queue = loadQueue();
  const subjectsById = loadSubjectsById();
  const processed = loadOneByOneProcessedIds();
  const alreadyPromoted = loadAlreadyPromotedIds();
  const bbPublicBefore = await countBbPublic();
  const items = loadRunItems();
  const remainingAtStart = queue.filter((id) => !processed.has(id)).length;

  const totals: Totals = {
    processed: processed.size,
    keeps: 0,
    needsEvidence: 0,
    errors: 0,
    promoteEligible: 0,
    promoted: alreadyPromoted.size,
    lastFive: [],
    sessionProcessed: 0,
  };
  const pendingEligible: EnrichmentItem[] = [];
  const waveNumRef = { value: 0 };
  const sessionId = `dc-rejudge-${Date.now()}`;

  const tasks: QueueTask[] = [];
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]!;
    if (processed.has(id)) continue;
    const subject = subjectsById.get(id);
    if (!subject) {
      await withWriteLock(() => {
        totals.processed += 1;
        totals.sessionProcessed += 1;
        const line: ProgressLine = {
          id,
          displayName: id,
          model: 'none',
          decision: 'skip',
          confidence: null,
          promoteEligible: false,
          pass: PASS_LABEL,
          promoteReason: 'subject not found',
          at: new Date().toISOString(),
          index: i + 1,
          total: queue.length,
        };
        appendProgress(line, totals, queue.length);
      });
      continue;
    }
    tasks.push({ id, index: i + 1, subject });
  }

  console.error(
    `Starting rejudge: ${remainingAtStart} remaining, concurrency ${CONCURRENCY}, primary ${PRIMARY_MODEL}`,
  );

  await runPool(tasks, queue.length, sessionId, totals, items, pendingEligible, waveNumRef);

  if (pendingEligible.length > 0) {
    waveNumRef.value += 1;
    console.error(`\n*** FINAL PROMOTE WAVE ${waveNumRef.value}: ${pendingEligible.length} items ***`);
    const promotedIds = flushPromoteWave(pendingEligible, waveNumRef.value);
    totals.promoted += promotedIds.length;
    console.error(`promoted to bb_public: ${promotedIds.join(', ') || '(none)'}`);
    pendingEligible.length = 0;
  }

  const bbPublicAfter = await countBbPublic();
  const summary = {
    modelPolicy: MODEL_POLICY,
    remainingAtStart,
    processedCumulative: totals.processed,
    sessionProcessed: totals.sessionProcessed,
    keeps: totals.keeps,
    needsEvidence: totals.needsEvidence,
    errors: totals.errors,
    promoteEligible: totals.promoteEligible,
    promotedThisRun: totals.promoted - alreadyPromoted.size,
    promoteWaves: waveNumRef.value,
    bbPublicBefore,
    bbPublicAfter,
    bbPublicDelta: bbPublicAfter - bbPublicBefore,
    progressFile: progressPath,
    statusFile: statusPath,
  };
  writeFileSync(join(cacheDir, 'rejudge-one-by-one-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

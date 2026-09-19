import {
  retrieveEvidence,
  parseEvidenceQueryVector,
  indexCaptureText,
  attachPassageEmbedding,
} from './evidence-retrieval.js';
/**
 * Thin argument-parsing CLI over this package's real, tested functions mirrors the
 * parse-args-then-call-a-tested-function shape of
 * packages/ops-data/src/embeddings/backfill-cli.ts elsewhere in this repo. No business logic
 * lives in this file: every command below builds an input object and calls a `prepare*`/`run*`
 * function from `intake.ts`, `bulk-import.ts`, or `discovery-run.ts`.
 *
 * SAFE BY DEFAULT: every command only *prepares* an outcome and prints it as JSON. Passing
 * `--commit` is required to write anything. Intake commands call `commitOperatorIntake`;
 * `locate --commit` calls `commitLocate` (both use real `commitWithAudit`). There is no
 * `--publish`, `--approve`, or `--promote` flag anywhere in this CLI see
 * `promotion-boundary.test.ts`.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import {
  assertContract,
  validateExecutionPlan,
  blackHistoryProfile,
  type PreservationDecision,
} from '@repo/research-kernel';
import {
  startResearchExecution,
  claimResearchTask,
  completeResearchTask,
  heartbeatResearchTask,
  researchExecutionStatus,
  type ExecutionPool,
  type TaskModelMetadata,
} from './research-execution.js';
import type { AuthorityFollowUpLead, RelationshipRole, RelationshipType } from '@repo/domain';
import { getOpsPostgresPool, type AtomicStore } from '@repo/data-access';
import type { SafeFetchDependencies } from '@repo/security/url-safety';
import {
  parseLeadsFromText,
  prepareBulkLeadIntake,
  type BulkImportFormat,
  type BulkImportSummary,
} from './bulk-import.js';
import { commitOperatorIntake } from './commit.js';
import { prepareDiscoverySurvivorIntake } from './discovery-survivor-intake.js';
import { runAuthorityFollowUpIntake } from './authority-followup-intake.js';
import type { DiscoveryRunBatch } from './discovery-run.js';
import { runBoundedDiscoveryCampaign } from './discovery-run.js';
import { runCommunityObscurityOperatorCampaign } from './community-obscurity-run.js';
import { runRssOperatorCampaign } from './rss-campaign-run.js';
import { dispatchDiscoveryCampaign } from '@repo/config/scheduled-jobs';
import { mergeJsonCatalogOverCanonical } from './editorial-catalog.js';
import { loadEditorialCatalogFromPostgres } from './editorial-catalog-postgres.js';
import { loadDiscoveryCatalogProfilesFromPostgres } from './discovery-catalog-postgres.js';
import {
  runEditorialJudge,
  type EditorialCatalogEntity,
  type EditorialProgressEvent,
} from './editorial-run.js';
import { prepareEditorialPacketIntake } from './editorial-intake.js';
import {
  RESEARCH_MATURITY_STATES,
  assessResearchMaturity,
  blockersToNextState,
  type ResearchMaturity,
} from '@repo/domain';
import { runEnrichmentJudge } from './enrichment-run.js';
import {
  auditReleasedEntities,
  selectDeficitCohort,
  snapshotForReleasedEntity,
  type ReleasedClaim,
} from './research-quality-audit.js';
import {
  describePlan,
  planEnrichment,
  targetIsAbove,
  enrichmentExecutionPlan,
} from './enrichment-plan.js';
import { runResearchWorker } from './research-worker.js';
import { assessReviewedMaturity } from './reviewed-maturity.js';
import { createLlmProvider } from './llm-provider.js';
import { loadPendingEditorialItems } from './pending-list.js';
import {
  commitQuarantineTriagePlans,
  judgeQuarantineItem,
  prepareQuarantineTriageDecision,
  type QuarantineIntakeItem,
  type QuarantineTriagePlan,
} from './quarantine-triage.js';
import { runStoryResearch, type StoryTopicSeed } from './story-research-run.js';
import { prepareStoryPacketIntake } from './story-intake.js';
import { prepareEdgeIntake, type EdgeIntakeInput } from './edge-intake.js';
import {
  ensureSourceProgramRun,
  expandEntityNetwork,
  insertLandscapeCandidateRows,
  loadExpansionSeed,
  stageNetworkCandidates,
} from './expand-verb.js';
import {
  HARNESS_ADJUDICATION_PROGRAM_ID,
  stageHarnessAdjudicatedRelationships,
} from './harness-relationship-staging.js';
import { createNodeSafeFetchDependencies, runQuickAddFetch } from './fetch.js';
import {
  createMetadataOnlyStorage,
  type CaptureDeps,
  type CaptureStorage,
} from './source-capture.js';
import { createSupabaseStorage, supabaseStorageConfigFromEnv } from './supabase-storage.js';
import { runCaptureBackfill, persistCapture, type CaptureDb } from './capture-backfill.js';
import { waybackCredentialsFromEnv } from './wayback-credentials.js';
import {
  createWaybackAnchor,
  createPostgresWaybackJobStore,
  validatePreservationDecision,
} from './wayback-anchor.js';
import {
  sweepCaptureRetention,
  drainCaptureDisposals,
  reconcileOrphanCaptures,
} from './capture-retention.js';
import { createWaybackLookup } from './wayback-lookup.js';
import { waybackSafeHttpClient } from './wayback-http.js';

/**
 * Capture blob sink selection: Supabase Storage when SUPABASE_URL + SUPABASE_SECRET_KEY are
 * configured (blobs live next to the evidence DB, no legacy GCP dependency), else honest
 * metadata-only (no retained source text).
 */
function captureStorageFromEnv(
  env: Record<string, string | undefined>,
  decisions: readonly PreservationDecision[] = [],
): CaptureStorage {
  const config = supabaseStorageConfigFromEnv(env);

  return {
    kind: 'policy-controlled',
    async store(input) {
      const candidate = decisions.find((decision) => decision.sourceUrl === input.url);
      const decision = candidate
        ? validatePreservationDecision(candidate, input.url, new Date().toISOString())
        : undefined;
      const stored = await (
        decision?.allowTextRetention && config
          ? createSupabaseStorage({
              ...config,
              retentionRevision: createHash('sha256')
                .update(JSON.stringify(decision))
                .digest('hex'),
            })
          : createMetadataOnlyStorage()
      ).store(input);
      return { ...stored, preservationDecision: decision ?? null };
    },
  };
}
import type { ResearchCaptureSink } from './research-intake.js';
import { createHash } from 'node:crypto';
import { OPERATOR_SOURCES, type OperatorIdentity, type OperatorSource } from './identity.js';
import {
  prepareEvidenceAttachmentIntake,
  prepareLeadIntake,
  prepareSourceRegistrationIntake,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';
import { censusSafeHttpClient } from './census-http.js';
import { commitLocate, prepareLocate } from './locate.js';
import { runResearchIntake } from './research-intake.js';
import { runWorkerPreflight } from './worker-preflight.js';
import { loadLaneModelSpend, formatLaneSpendReport } from './model-invocation-log.js';
import {
  loadTougalooGeojsonFeatures,
  runSundownTownCountyBrief,
  TOUGALOO_GEOJSON_URL,
} from './research-directive.js';
import {
  fetchNpsNetworkToFreedom,
  fetchDplaItems,
  findRelationshipCandidates,
  enrichSubjectCandidate,
  adjudicateRelationship,
  InvalidHarnessOutputError,
  type HarnessRawSubject,
  type EnrichmentBridgeClient,
  type EnrichedCandidate,
  type AdjudicatedRelationship,
} from '@repo/research-harness';
import { assertPostgresOpsDataSource, editorialCatalogFromError } from './ops-data-source-gate.js';
import { describeRoutedSearch } from '@repo/domain';
import { runSearchQueries, type ResolvedSearchProvider } from './search-routing.js';
import { gatherSourceSnippetsFromUrls } from './research-source-gather.js';
import { deriveSuggestedTitle } from './fetch.js';

export type CliDependencies = {
  readonly store?: AtomicStore;
  readonly nowMs?: number;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
  readonly readFile?: (path: string) => string;
  /** Sync file writer used by `--output` (defaults to `writeFileSync`). */
  readonly writeFile?: (path: string, contents: string) => void;
  /** Sync append used for streaming progress NDJSON (defaults to `appendFileSync`). */
  readonly appendFile?: (path: string, contents: string) => void;
  /** Lazily builds the Postgres store when `--commit` is set and no store is injected. */
  readonly createLiveStore?: () => Promise<AtomicStore>;
  /** Overrides the real DNS/HTTP dependencies `research-intake` passes to `runQuickAddFetch`. */
  readonly fetchDependencies?: SafeFetchDependencies;
  /**
   * Overrides provider resolution for the verbs that search. Supplying it skips the environment
   * reads and the client construction, which is what makes a search-bearing verb testable without
   * a SearXNG instance.
   */
  readonly searchProvider?: ResolvedSearchProvider;
  /** Injected only for bounded CLI tests; production resolves the configured Postgres pool. */
  readonly postgresPool?: ExecutionPool;
  /** Capture inventory/persistence boundary for bounded capture-backfill CLI tests. */
  readonly captureDb?: CaptureDb;
};

type Flags = {
  readonly values: Map<string, string>;
  readonly repeated: Map<string, string[]>;
  readonly booleans: Set<string>;
};

const REPEATABLE_FLAGS = new Set(['--source-url', '--feed-xml', '--from']);
const BOOLEAN_FLAGS = new Set([
  '--approximate',
  '--commit',
  '--continue-on-quarantine',
  '--delete-storage',
  '--enrich',
  '--full',
  '--include-curated',
  '--omit-raw-model',
  '--orphans',
  '--queue-survivors',
  '--wayback',
  // Accepted uniformly on every verb: every command already prints JSON by
  // default (see the file header comment), so this flag is a no-op that makes the contract
  // explicit and machine-discoverable rather than switching a text-mode command to JSON.
  '--json',
]);

type EditorialSubjectFile = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly existingSummary?: string;
  readonly existingContext?: string;
  readonly sourceSnippets?: readonly string[];
};

function parseFlags(argv: readonly string[]): Flags {
  const values = new Map<string, string>();
  const repeated = new Map<string, string[]>();
  const booleans = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    if (BOOLEAN_FLAGS.has(arg)) {
      booleans.add(arg);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`Flag ${arg} requires a value`);
    index += 1;
    if (REPEATABLE_FLAGS.has(arg)) {
      const existing = repeated.get(arg) ?? [];
      existing.push(value);
      repeated.set(arg, existing);
    } else {
      values.set(arg, value);
    }
  }
  return { values, repeated, booleans };
}

function requireFlag(flags: Flags, name: string): string {
  const value = flags.values.get(name);
  if (!value) throw new Error(`Missing required flag ${name}`);
  return value;
}

function optionalFlag(flags: Flags, name: string): string | undefined {
  return flags.values.get(name);
}

/** Default completion model when `--model` is omitted for a live LLM provider. */
function defaultModelForProvider(
  providerName: 'mock' | 'openrouter' | 'ollama' | 'hybrid',
  ollamaModel: string | undefined,
): string {
  switch (providerName) {
    case 'openrouter':
    case 'hybrid':
      // Empty model when a rotation roster is configured — the provider picks per attempt.
      return (
        process.env.OPENROUTER_MODEL ??
        (process.env.OPENROUTER_MODELS ? '' : 'openai/gpt-oss-20b:free')
      );
    case 'ollama':
      return ollamaModel ?? process.env.OLLAMA_MODEL ?? 'qwen3:8b';
    case 'mock':
    default:
      return 'mock-editorial-v1';
  }
}

function emitEditorialProgress(options: {
  readonly event: EditorialProgressEvent;
  readonly stderr: (line: string) => void;
  readonly appendFile: (path: string, contents: string) => void;
  readonly progressPath?: string;
}): void {
  const line = JSON.stringify({
    kind: 'enrichment.progress.v1',
    completed: options.event.completed,
    total: options.event.total,
    index: options.event.index,
    subjectId: options.event.subjectId,
    title: options.event.title,
    decision: options.event.decision,
    ...(options.event.error !== undefined ? { error: options.event.error.slice(0, 240) } : {}),
    ...(options.event.servedBy !== undefined ? { servedBy: options.event.servedBy } : {}),
    ...(options.event.modelId !== undefined ? { modelId: options.event.modelId } : {}),
  });
  options.stderr(line);
  if (options.progressPath) {
    options.appendFile(options.progressPath, `${line}\n`);
  }
}

function emitQuarantineTriageProgress(options: {
  readonly line: Readonly<Record<string, unknown>>;
  readonly stderr: (line: string) => void;
  readonly appendFile: (path: string, contents: string) => void;
  readonly progressPath?: string;
}): void {
  const line = JSON.stringify({ kind: 'quarantine.triage.progress.v1', ...options.line });
  options.stderr(line);
  if (options.progressPath) {
    options.appendFile(options.progressPath, `${line}\n`);
  }
}

function emitHarnessProgress(options: {
  readonly line: Readonly<Record<string, unknown>>;
  readonly stderr: (line: string) => void;
  readonly appendFile: (path: string, contents: string) => void;
  readonly progressPath?: string;
}): void {
  const line = JSON.stringify({ kind: 'harness.run.progress.v1', ...options.line });
  options.stderr(line);
  if (options.progressPath) {
    options.appendFile(options.progressPath, `${line}\n`);
  }
}

/**
 * Emit a large editorial/enrichment JSON payload safely.
 *
 * Overnight runs historically piped `console.log(JSON.stringify(result))` through
 * `tee` into systemd's journal. Node can exit before a multi-MB stdout buffer is
 * fully flushed into a 64KiB pipe, leaving a truncated file and a false
 * `itemCount: 0` summary. When `--output` is set we write synchronously to disk
 * and only print a compact summary on stdout for the journal.
 */
function emitRunJson(options: {
  readonly payload: unknown;
  readonly flags: Flags;
  readonly stdout: (line: string) => void;
  readonly writeFile: (path: string, contents: string) => void;
}): void {
  const omitRaw = options.flags.booleans.has('--omit-raw-model');
  const body = omitRaw ? stripRawModelContent(options.payload) : options.payload;
  const serialized = `${JSON.stringify(body, null, 2)}\n`;
  const outputPath = optionalFlag(options.flags, '--output');
  if (outputPath) {
    options.writeFile(outputPath, serialized);
    options.stdout(JSON.stringify(compactRunSummary(body), null, 2));
    return;
  }
  options.stdout(serialized.trimEnd());
}

function stripRawModelContent(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map((entry) => stripRawModelContent(entry));
  const record = payload as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'rawModelContent') continue;
    next[key] = stripRawModelContent(value);
  }
  return next;
}

function compactRunSummary(payload: unknown): Record<string, unknown> {
  const root =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const result =
    root.result !== null && typeof root.result === 'object' && !Array.isArray(root.result)
      ? (root.result as Record<string, unknown>)
      : root;
  const items = Array.isArray(result.items) ? result.items : [];
  const servedBy: Record<string, number> = {};
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const packet =
      row.packet !== null && typeof row.packet === 'object' && !Array.isArray(row.packet)
        ? (row.packet as Record<string, unknown>)
        : {};
    const model =
      packet.model !== null && typeof packet.model === 'object' && !Array.isArray(packet.model)
        ? (packet.model as Record<string, unknown>)
        : {};
    const key =
      (typeof row.servedBy === 'string' && row.servedBy) ||
      (typeof model.provider === 'string' && model.provider) ||
      'unknown';
    servedBy[key] = (servedBy[key] ?? 0) + 1;
  }
  return {
    kind: result.kind ?? root.kind ?? 'run.summary.v1',
    itemCount: items.length,
    keepCount: result.keepCount ?? null,
    rejectCount: result.rejectCount ?? null,
    needsEvidenceCount: result.needsEvidenceCount ?? null,
    errorCount: result.errorCount ?? null,
    concurrency: result.concurrency ?? null,
    servedBy,
    ...(Array.isArray(root.commits) ? { commitCount: root.commits.length } : {}),
  };
}

function readOperatorIdentity(flags: Flags): OperatorIdentity {
  const source = (optionalFlag(flags, '--identity-source') ?? 'cli') as OperatorSource;
  if (!OPERATOR_SOURCES.includes(source)) {
    throw new Error(`--identity-source must be one of ${OPERATOR_SOURCES.join(', ')}`);
  }
  const displayName = optionalFlag(flags, '--display-name');
  return {
    operatorId: requireFlag(flags, '--operator-id'),
    sessionId: requireFlag(flags, '--session-id'),
    source,
    ...(displayName ? { displayName } : {}),
  };
}

function buildContext(flags: Flags, deps: CliDependencies): OperatorIntakeContext {
  return {
    identity: readOperatorIdentity(flags),
    privacyPepper: optionalFlag(flags, '--privacy-pepper') ?? requirePepperFromEnv(),
    nowMs: deps.nowMs ?? Date.now(),
  };
}

function requirePepperFromEnv(): string {
  const pepper = process.env.OPERATOR_CLI_PRIVACY_PEPPER;
  if (!pepper) {
    throw new Error(
      'Set OPERATOR_CLI_PRIVACY_PEPPER or pass --privacy-pepper (used only to digest optional ' +
        'submitter contact info; never logged or stored raw).',
    );
  }
  return pepper;
}

async function finish(
  outcome: OperatorIntakeOutcome,
  flags: Flags,
  deps: CliDependencies,
): Promise<Record<string, unknown>> {
  if (!outcome.accepted) {
    return { accepted: false, rejection: outcome.rejection };
  }
  const summary: Record<string, unknown> = {
    accepted: true,
    proposalKind: outcome.proposalKind,
    submissionId: outcome.submission.id,
    moderationState: outcome.submission.moderationState,
    ...(outcome.researchCase ? { researchCaseId: outcome.researchCase.id } : {}),
    committed: false,
  };
  if (flags.booleans.has('--commit')) {
    const store = deps.store ?? (await (deps.createLiveStore ?? createDefaultLiveStore)());
    const result = await commitOperatorIntake(store, outcome);
    summary.committed = result.committed;
    summary.replayed = result.replayed;
    summary.auditEventId = result.eventId;
    summary.outboxMessageId = result.outboxMessageId;
  }
  return summary;
}

async function createDefaultLiveStore(): Promise<AtomicStore> {
  assertPostgresOpsDataSource(process.env);
  const { createLiveAtomicStoreFromEnv } = await import('@repo/data-access');
  return createLiveAtomicStoreFromEnv(process.env);
}

function inferFormat(path: string, flags: Flags): BulkImportFormat {
  const explicit = optionalFlag(flags, '--format');
  if (explicit === 'csv' || explicit === 'markdown') return explicit;
  return path.toLowerCase().endsWith('.csv') ? 'csv' : 'markdown';
}

export async function runCli(argv: readonly string[], deps: CliDependencies = {}): Promise<number> {
  const stdout = deps.stdout ?? ((line: string) => console.log(line));
  const stderr = deps.stderr ?? ((line: string) => console.error(line));
  const readFile = deps.readFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const writeFile =
    deps.writeFile ?? ((path: string, contents: string) => writeFileSync(path, contents, 'utf8'));
  const appendFile =
    deps.appendFile ?? ((path: string, contents: string) => appendFileSync(path, contents, 'utf8'));
  const [command, ...rest] = argv;

  try {
    const flags = parseFlags(rest);
    switch (command) {
      case 'capture-retention': {
        if (!deps.postgresPool) assertPostgresOpsDataSource(process.env);
        const pool = deps.postgresPool ?? getOpsPostgresPool();
        const commit = flags.booleans.has('--commit');
        const sourceItemId = optionalFlag(flags, '--source-item-id');
        const limit = Number(optionalFlag(flags, '--limit') ?? '100');
        if (flags.booleans.has('--orphans'))
          stdout(
            JSON.stringify(
              await reconcileOrphanCaptures(pool, {
                commit,
                actor: requireFlag(flags, '--operator-id'),
                limit,
                bucket: requireFlag(flags, '--bucket'),
              }),
              null,
              2,
            ),
          );
        const result = await sweepCaptureRetention(pool, {
          commit,
          actor: requireFlag(flags, '--operator-id'),
          limit,
          ...(sourceItemId ? { sourceItemId } : {}),
        });
        stdout(JSON.stringify(result, null, 2));
        if (flags.booleans.has('--delete-storage')) {
          if (!commit) throw new Error('--delete-storage requires --commit');
          const config = supabaseStorageConfigFromEnv(process.env);
          if (!config) throw new Error('Capture storage must be configured for disposal');
          stdout(JSON.stringify(await drainCaptureDisposals(pool, config, limit), null, 2));
        }
        return 0;
      }
      case 'research-retrieve': {
        assertPostgresOpsDataSource(process.env);
        const vectorPath = optionalFlag(flags, '--vector-file');
        const vector = vectorPath
          ? parseEvidenceQueryVector(JSON.parse(readFile(vectorPath)))
          : undefined;
        const sourceIds = optionalFlag(flags, '--source-item-ids');
        const result = await retrieveEvidence(getOpsPostgresPool(), {
          query: requireFlag(flags, '--query'),
          limit: Number(optionalFlag(flags, '--limit') ?? 10),
          ...(sourceIds ? { sourceItemIds: sourceIds.split(',') } : {}),
          ...(vector ? { vector } : {}),
          approximate: flags.booleans.has('--approximate'),
        });
        stdout(JSON.stringify(result, null, 2));
        return 0;
      }
      case 'research-index': {
        if (!flags.booleans.has('--commit')) throw new Error('research-index requires --commit');
        assertPostgresOpsDataSource(process.env);
        const count = await indexCaptureText(getOpsPostgresPool(), {
          captureId: requireFlag(flags, '--capture-id'),
          sourceItemId: requireFlag(flags, '--source-item-id'),
          parserVersion: requireFlag(flags, '--parser-version'),
          text: readFile(requireFlag(flags, '--text-path')),
          decision: assertContract(
            'PreservationDecision',
            JSON.parse(readFile(requireFlag(flags, '--preservation-decision'))),
          ),
        });
        stdout(JSON.stringify({ indexedPassages: count }));
        return 0;
      }
      case 'research-embed': {
        if (!flags.booleans.has('--commit')) throw new Error('research-embed requires --commit');
        assertPostgresOpsDataSource(process.env);
        const input = JSON.parse(readFile(requireFlag(flags, '--embedding-file'))) as Parameters<
          typeof attachPassageEmbedding
        >[1];
        await attachPassageEmbedding(getOpsPostgresPool(), input);
        stdout(JSON.stringify({ stored: true, passageId: input.passageId }));
        return 0;
      }
      case 'research-run': {
        const plan = validateExecutionPlan(JSON.parse(readFile(requireFlag(flags, '--plan'))));
        const result = flags.booleans.has('--commit')
          ? (assertPostgresOpsDataSource(process.env),
            await startResearchExecution(getOpsPostgresPool(), plan))
          : { runId: plan.run.id, created: false, validated: true, tasks: plan.tasks.length };
        stdout(JSON.stringify(result, null, 2));
        return 0;
      }
      case 'research-status': {
        assertPostgresOpsDataSource(process.env);
        stdout(
          JSON.stringify(
            await researchExecutionStatus(getOpsPostgresPool(), requireFlag(flags, '--run-id')),
            null,
            2,
          ),
        );
        return 0;
      }
      case 'research-work': {
        if (!flags.booleans.has('--commit'))
          throw new Error(
            'research-work requires --commit for ledger writes and bounded external calls',
          );
        assertPostgresOpsDataSource(process.env);
        const result = await runResearchWorker(getOpsPostgresPool(), {
          runId: requireFlag(flags, '--run-id'),
          workerId: requireFlag(flags, '--worker-id'),
          maxTasks: Number(requireFlag(flags, '--max-tasks')),
        });
        const output = optionalFlag(flags, '--output');
        if (output) writeFile(output, JSON.stringify(result, null, 2));
        stdout(JSON.stringify(result, null, 2));
        return result.attempts.some((attempt) => !attempt.valid) ? 1 : 0;
      }
      case 'research-claim':
      case 'research-heartbeat':
      case 'research-complete': {
        if (!flags.booleans.has('--commit'))
          throw new Error(`${command} requires --commit to change the execution ledger`);
        assertPostgresOpsDataSource(process.env);
        const pool = getOpsPostgresPool();
        let result: unknown;
        if (command === 'research-claim') {
          result = await claimResearchTask(
            pool,
            requireFlag(flags, '--run-id'),
            requireFlag(flags, '--worker-id'),
            Number(optionalFlag(flags, '--lease-seconds') ?? '300'),
          );
        } else {
          const lease = assertContract(
            'ResearchTaskLease',
            JSON.parse(readFile(requireFlag(flags, '--lease-path'))),
          );
          if (command === 'research-heartbeat') {
            result = {
              renewed: await heartbeatResearchTask(
                pool,
                lease,
                Number(optionalFlag(flags, '--lease-seconds') ?? '300'),
              ),
            };
          } else {
            const modelPath = optionalFlag(flags, '--model-record');
            result = await completeResearchTask(
              pool,
              lease,
              readFile(requireFlag(flags, '--result-path')),
              modelPath ? (JSON.parse(readFile(modelPath)) as TaskModelMetadata) : undefined,
            );
          }
        }
        const json = JSON.stringify(result, null, 2);
        const output = optionalFlag(flags, '--output');
        if (output) writeFile(output, json);
        stdout(json);
        return result &&
          typeof result === 'object' &&
          (('valid' in result && result.valid === false) ||
            ('renewed' in result && result.renewed === false))
          ? 1
          : 0;
      }
      case 'preflight': {
        const report = await runWorkerPreflight();
        stdout(JSON.stringify(report, null, 2));
        return report.ok ? 0 : 1;
      }
      case 'model-report': {
        const sinceFlag = optionalFlag(flags, '--since');
        const since = sinceFlag ? new Date(sinceFlag) : undefined;
        if (since && Number.isNaN(since.getTime())) {
          stderr(`--since is not a valid date: ${sinceFlag}\n`);
          return 1;
        }
        const asJson = flags.booleans.has('--json');
        const pool = getOpsPostgresPool(process.env);
        const rows = await loadLaneModelSpend(pool, { ...(since ? { since } : {}) });
        stdout(asJson ? JSON.stringify(rows, null, 2) : `${formatLaneSpendReport(rows)}\n`);
        return 0;
      }
      case 'submit-lead': {
        const sourceUrls = flags.repeated.get('--source-url');
        const title = optionalFlag(flags, '--title');
        const url = optionalFlag(flags, '--url');
        const location = optionalFlag(flags, '--location');
        const era = optionalFlag(flags, '--era');
        const targetRecordId = optionalFlag(flags, '--target-record-id');
        const contact = optionalFlag(flags, '--contact');
        const outcome = prepareLeadIntake(
          {
            description: requireFlag(flags, '--description'),
            ...(title ? { title } : {}),
            ...(url ? { url } : {}),
            ...(sourceUrls ? { sourceUrls } : {}),
            ...(location ? { location } : {}),
            ...(era ? { era } : {}),
            ...(targetRecordId ? { targetRecordId } : {}),
            ...(contact ? { submitterContact: contact } : {}),
          },
          buildContext(flags, deps),
        );
        stdout(JSON.stringify(await finish(outcome, flags, deps), null, 2));
        return 0;
      }
      case 'research-intake': {
        const title = optionalFlag(flags, '--title');
        const description = optionalFlag(flags, '--description');
        const location = optionalFlag(flags, '--location');
        const era = optionalFlag(flags, '--era');
        const targetRecordId = optionalFlag(flags, '--target-record-id');
        const contact = optionalFlag(flags, '--contact');
        const fetchDependencies = deps.fetchDependencies ?? createNodeSafeFetchDependencies();
        // With --commit, persist a real evidence capture for the fetched URL instead of
        // only planning one; without it, intake stays a dry preview (no DB write).
        let researchCaptureSink: ResearchCaptureSink | undefined;
        if (flags.booleans.has('--commit')) {
          const pool = getOpsPostgresPool(process.env);
          researchCaptureSink = {
            storage: captureStorageFromEnv(process.env),
            newId: (prefix, seed) =>
              `${prefix}_${createHash('sha1').update(seed).digest('hex').slice(0, 16)}`,
            persist: async (capture, event) => {
              await persistCapture(pool, capture, event);
            },
          };
        }
        const research = await runResearchIntake(
          {
            url: requireFlag(flags, '--url'),
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            ...(location ? { location } : {}),
            ...(era ? { era } : {}),
            ...(targetRecordId ? { targetRecordId } : {}),
            ...(contact ? { submitterContact: contact } : {}),
          },
          buildContext(flags, deps),
          fetchDependencies,
          researchCaptureSink,
        );
        if (!research.fetch.ok) {
          stdout(JSON.stringify({ fetch: research.fetch }, null, 2));
          return 0;
        }
        const intakeSummary = research.intake
          ? await finish(research.intake, flags, deps)
          : undefined;
        stdout(
          JSON.stringify(
            {
              fetch: {
                ok: true,
                finalUrl: research.fetch.finalUrl,
                contentHash: research.fetch.contentHash,
              },
              citation: research.citation,
              capturePlan: research.capturePlan,
              capture: research.capture,
              intake: intakeSummary,
            },
            null,
            2,
          ),
        );
        return 0;
      }
      case 'authority-followup-intake': {
        // Reads a DiscoveryCampaignResult (or a bare AuthorityFollowUpLead[]) from
        // --leads-file and runs the existing single-URL research-intake path once per lead,
        // reusing the exact SSRF-safe fetch / citation-prefill / draft-case plumbing above —
        // no new fetch or commit logic. See authority-followup-intake.ts for why this exists.
        const leadsFilePath = requireFlag(flags, '--leads-file');
        const parsed: unknown = JSON.parse(readFile(leadsFilePath));
        const leads: readonly AuthorityFollowUpLead[] = Array.isArray(parsed)
          ? (parsed as readonly AuthorityFollowUpLead[])
          : ((parsed as { readonly authorityFollowUps?: readonly AuthorityFollowUpLead[] })
              .authorityFollowUps ?? []);
        const maxLeadsRaw = optionalFlag(flags, '--max-leads');
        const fetchDependencies = deps.fetchDependencies ?? createNodeSafeFetchDependencies();
        // Same commit gating as `research-intake`: only persist an evidence capture per fetch
        // when --commit is passed, otherwise this stays a dry preview (no DB write).
        let researchCaptureSink: ResearchCaptureSink | undefined;
        if (flags.booleans.has('--commit')) {
          const pool = getOpsPostgresPool(process.env);
          researchCaptureSink = {
            storage: captureStorageFromEnv(process.env),
            newId: (prefix, seed) =>
              `${prefix}_${createHash('sha1').update(seed).digest('hex').slice(0, 16)}`,
            persist: async (capture, event) => {
              await persistCapture(pool, capture, event);
            },
          };
        }
        const result = await runAuthorityFollowUpIntake({
          leads,
          context: buildContext(flags, deps),
          dependencies: fetchDependencies,
          ...(researchCaptureSink ? { captureSink: researchCaptureSink } : {}),
          ...(maxLeadsRaw !== undefined ? { maxLeads: Number(maxLeadsRaw) } : {}),
        });
        const items: Record<string, unknown>[] = [];
        for (const item of result.items) {
          const intakeSummary = item.outcome.intake
            ? await finish(item.outcome.intake, flags, deps)
            : undefined;
          items.push({
            leadUrl: item.leadUrl,
            host: item.host,
            parentCandidateId: item.parentCandidateId,
            parentStableIdentifier: item.parentStableIdentifier,
            fetch: item.outcome.fetch.ok
              ? {
                  ok: true,
                  finalUrl: item.outcome.fetch.finalUrl,
                  contentHash: item.outcome.fetch.contentHash,
                }
              : { ok: false, reason: item.outcome.fetch.reason },
            citation: item.outcome.citation,
            capture: item.outcome.capture,
            intake: intakeSummary,
          });
        }
        stdout(
          JSON.stringify(
            { version: result.version, considered: result.considered, items },
            null,
            2,
          ),
        );
        return 0;
      }
      case 'register-source': {
        const notes = optionalFlag(flags, '--notes');
        const classification = optionalFlag(flags, '--classification');
        const outcome = prepareSourceRegistrationIntake(
          {
            organizationName: requireFlag(flags, '--org'),
            homepageUrl: requireFlag(flags, '--homepage'),
            ...(notes ? { notes } : {}),
            ...(classification ? { suggestedClassification: classification } : {}),
          },
          buildContext(flags, deps),
        );
        stdout(JSON.stringify(await finish(outcome, flags, deps), null, 2));
        return 0;
      }
      case 'attach-evidence': {
        const sourceUrls = flags.repeated.get('--source-url') ?? [];
        const contact = optionalFlag(flags, '--contact');
        const outcome = prepareEvidenceAttachmentIntake(
          {
            researchCaseId: requireFlag(flags, '--case-id'),
            description: requireFlag(flags, '--description'),
            sourceUrls,
            ...(contact ? { submitterContact: contact } : {}),
          },
          buildContext(flags, deps),
        );
        stdout(JSON.stringify(await finish(outcome, flags, deps), null, 2));
        return 0;
      }
      case 'bulk-import': {
        const path = requireFlag(flags, '--file');
        const text = readFile(path);
        const rows = parseLeadsFromText(text, inferFormat(path, flags));
        const context = buildContext(flags, deps);
        const summary: BulkImportSummary = prepareBulkLeadIntake(rows, context);
        const committedRows: Record<string, unknown>[] = [];
        for (const row of summary.rows) {
          committedRows.push({ rowIndex: row.rowIndex, ...(await finish(row, flags, deps)) });
        }
        stdout(
          JSON.stringify(
            {
              total: summary.total,
              acceptedCount: summary.acceptedCount,
              rejectedCount: summary.rejectedCount,
              rows: committedRows,
            },
            null,
            2,
          ),
        );
        return 0;
      }
      case 'propose-edge': {
        // Edge intake through the existing operator CLI, no parallel writer.
        // `prepareEdgeIntake` hard-gates caused/enabled edges before quarantine;
        // see edge-intake.ts's module doc.
        const sourceUrls = flags.repeated.get('--source-url') ?? [];
        const type = requireFlag(flags, '--type') as RelationshipType;
        const role = optionalFlag(flags, '--role') as RelationshipRole | undefined;
        const validFrom = optionalFlag(flags, '--valid-from');
        const validTo = optionalFlag(flags, '--valid-to');
        const temporalLabel = optionalFlag(flags, '--temporal-label');
        const causalScope = optionalFlag(flags, '--causal-scope');
        const consensusBasis = optionalFlag(flags, '--consensus-basis');
        const contact = optionalFlag(flags, '--contact');
        const notes = optionalFlag(flags, '--notes');
        const temporal =
          validFrom || validTo || temporalLabel
            ? {
                ...(validFrom ? { validFrom } : {}),
                ...(validTo ? { validTo } : {}),
                ...(temporalLabel ? { label: temporalLabel } : {}),
              }
            : undefined;
        const causalReview: EdgeIntakeInput['causalReview'] =
          causalScope === 'systemic_consensus'
            ? {
                scope: 'systemic_consensus' as const,
                ...(consensusBasis ? { consensusBasis } : {}),
              }
            : causalScope === 'contested_or_single_incident'
              ? { scope: 'contested_or_single_incident' as const }
              : undefined;
        const input: EdgeIntakeInput = {
          fromEntityId: requireFlag(flags, '--from-entity-id'),
          toEntityId: requireFlag(flags, '--to-entity-id'),
          type,
          sourceUrls,
          ...(role ? { role } : {}),
          ...(temporal ? { temporal } : {}),
          ...(causalReview ? { causalReview } : {}),
          ...(notes ? { notes } : {}),
          ...(contact ? { submitterContact: contact } : {}),
        };
        const outcome = prepareEdgeIntake(input, buildContext(flags, deps));
        stdout(JSON.stringify(await finish(outcome, flags, deps), null, 2));
        return 0;
      }
      case 'discovery-run': {
        const batchPath = requireFlag(flags, '--batch');
        const batch = JSON.parse(readFile(batchPath)) as DiscoveryRunBatch;
        const countries = (optionalFlag(flags, '--countries') ?? 'US')
          .split(',')
          .map((c) => c.trim());
        const { summary } = runBoundedDiscoveryCampaign({
          batch,
          config: {
            campaignId: requireFlag(flags, '--campaign-id'),
            budget: {
              maxCandidates: Number(optionalFlag(flags, '--max-candidates') ?? '100'),
              maxQuarantined: Number(optionalFlag(flags, '--max-quarantined') ?? '10'),
              maxDeadLetter: Number(optionalFlag(flags, '--max-dead-letter') ?? '5'),
              maxRetriesPerCandidate: Number(optionalFlag(flags, '--max-retries') ?? '2'),
            },
            boundaries: { countries },
            continueOnQuarantine: flags.booleans.has('--continue-on-quarantine'),
          },
          stampedAt: new Date(deps.nowMs ?? Date.now()).toISOString(),
          completedAt: new Date(deps.nowMs ?? Date.now()).toISOString(),
        });
        stdout(JSON.stringify(summary, null, 2));
        return 0;
      }
      case 'community-obscurity-run': {
        const pairs = flags.repeated.get('--feed-xml') ?? [];
        if (pairs.length === 0) {
          throw new Error(
            'community-obscurity-run requires --feed-xml feedId=/path/to/feed.xml (repeatable)',
          );
        }
        const feedXmlByFeedId = new Map<string, string>();
        for (const pair of pairs) {
          const eq = pair.indexOf('=');
          if (eq <= 0) {
            throw new Error(`--feed-xml must be feedId=/path (got ${pair})`);
          }
          const feedId = pair.slice(0, eq);
          const path = pair.slice(eq + 1);
          feedXmlByFeedId.set(feedId, readFile(path));
        }
        const catalogTitles = (optionalFlag(flags, '--catalog-titles') ?? '')
          .split('|')
          .map((title) => title.trim())
          .filter(Boolean);
        if (catalogTitles.length === 0) {
          throw new Error(
            'community-obscurity-run requires --catalog-titles "Title One|Title Two|..."',
          );
        }
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const campaignId = optionalFlag(flags, '--campaign-id');
        const runId = optionalFlag(flags, '--run-id');
        const maxCandidatesRaw = optionalFlag(flags, '--max-candidates');
        const { summary, result } = runCommunityObscurityOperatorCampaign({
          feedXmlByFeedId,
          catalogTitles,
          nowIso,
          ...(campaignId !== undefined ? { campaignId } : {}),
          ...(runId !== undefined ? { runId } : {}),
          ...(maxCandidatesRaw !== undefined ? { maxCandidates: Number(maxCandidatesRaw) } : {}),
        });
        const full = flags.booleans.has('--full');
        stdout(JSON.stringify(full ? { summary, result } : summary, null, 2));
        return 0;
      }
      case 'rss-campaign-run': {
        const pairs = flags.repeated.get('--feed-xml') ?? [];
        if (pairs.length === 0) {
          throw new Error(
            'rss-campaign-run requires --feed-xml feedId=/path/to/feed.xml (repeatable)',
          );
        }
        const feedXmlByFeedId = new Map<string, string>();
        for (const pair of pairs) {
          const eq = pair.indexOf('=');
          if (eq <= 0) {
            throw new Error(`--feed-xml must be feedId=/path (got ${pair})`);
          }
          const feedId = pair.slice(0, eq);
          const path = pair.slice(eq + 1);
          feedXmlByFeedId.set(feedId, readFile(path));
        }
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const campaignId = optionalFlag(flags, '--campaign-id');
        const runId = optionalFlag(flags, '--run-id');
        const maxCandidatesRaw = optionalFlag(flags, '--max-candidates');
        const { summary, result } = await runRssOperatorCampaign({
          feedXmlByFeedId,
          nowIso,
          ...(campaignId !== undefined ? { campaignId } : {}),
          ...(runId !== undefined ? { runId } : {}),
          ...(maxCandidatesRaw !== undefined ? { maxCandidates: Number(maxCandidatesRaw) } : {}),
          ...(flags.booleans.has('--include-curated')
            ? { includeCuratedCommunityFeeds: true }
            : {}),
        });
        const full = flags.booleans.has('--full');
        stdout(JSON.stringify(full ? { summary, result } : summary, null, 2));
        return 0;
      }
      case 'discovery-dispatch': {
        const jobId = requireFlag(flags, '--job');
        const modeRaw = optionalFlag(flags, '--mode') ?? 'fixture';
        if (modeRaw !== 'fixture' && modeRaw !== 'live') {
          throw new Error('--mode must be fixture or live');
        }
        const killRaw = optionalFlag(flags, '--kill-switch') ?? 'disengaged';
        if (killRaw !== 'engaged' && killRaw !== 'disengaged') {
          throw new Error('--kill-switch must be engaged or disengaged');
        }
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const jobRunId = optionalFlag(flags, '--run-id');
        const maxCandidatesRaw = optionalFlag(flags, '--max-candidates');
        const queueSurvivors = flags.booleans.has('--queue-survivors');
        const maxSurvivorsRaw = optionalFlag(flags, '--max-survivors');
        // Catalog matching is optional enrichment; a read failure preserves discovery output
        // while reporting that existing-record matching was unavailable.
        let catalogProfiles:
          Awaited<ReturnType<typeof loadDiscoveryCatalogProfilesFromPostgres>> | undefined;
        if (modeRaw === 'live' && killRaw !== 'engaged') {
          try {
            catalogProfiles = await loadDiscoveryCatalogProfilesFromPostgres({ nowIso });
          } catch (err) {
            stderr(
              `Warning: discovery catalog load failed (running without match): ${String(err)}\n`,
            );
          }
        }
        const result = await dispatchDiscoveryCampaign({
          jobId,
          mode: modeRaw,
          killSwitchEngaged: killRaw === 'engaged',
          nowIso,
          includeCampaign: queueSurvivors,
          ...(jobRunId !== undefined ? { jobRunId } : {}),
          ...(maxCandidatesRaw !== undefined ? { maxCandidates: Number(maxCandidatesRaw) } : {}),
          ...(catalogProfiles !== undefined ? { catalogProfiles } : {}),
        });

        let queueSummary: Record<string, unknown> | undefined;
        if (queueSurvivors && result.status === 'success' && result.campaign) {
          const intake = prepareDiscoverySurvivorIntake({
            campaign: result.campaign,
            context: buildContext(flags, deps),
            ...(maxSurvivorsRaw !== undefined ? { maxSurvivors: Number(maxSurvivorsRaw) } : {}),
          });
          const commits: Record<string, unknown>[] = [];
          if (flags.booleans.has('--commit')) {
            const store = deps.store ?? (await (deps.createLiveStore ?? createDefaultLiveStore)());
            for (const item of intake.items) {
              if (!item.outcome.accepted) continue;
              const committed = await commitOperatorIntake(store, item.outcome);
              commits.push({
                candidateId: item.candidateId,
                researchCaseId: item.outcome.researchCase?.id,
                committed: committed.committed,
                replayed: committed.replayed,
                auditEventId: committed.eventId,
              });
            }
          }
          queueSummary = {
            version: intake.version,
            considered: intake.considered,
            prepared: intake.prepared,
            skippedNoUrl: intake.skippedNoUrl,
            skippedRejected: intake.skippedRejected,
            committed: flags.booleans.has('--commit'),
            commitCount: commits.length,
            ...(flags.booleans.has('--full')
              ? {
                  items: intake.items.map((item) => ({
                    candidateId: item.candidateId,
                    title: item.title,
                    url: item.url,
                    researchCaseId: item.outcome.accepted
                      ? item.outcome.researchCase?.id
                      : undefined,
                  })),
                }
              : {}),
            ...(commits.length > 0 ? { commits } : {}),
          };
        } else if (queueSurvivors && result.status === 'success' && !result.campaign) {
          throw new Error(
            'discovery-dispatch --queue-survivors expected campaign payload but none was returned',
          );
        }

        const payload: Record<string, unknown> = {
          ...result,
          ...(queueSummary ? { survivorQueue: queueSummary } : {}),
        };
        // Drop bulky campaign from stdout unless --full (queue path already summarized).
        if (queueSurvivors && !flags.booleans.has('--full') && 'campaign' in payload) {
          delete payload.campaign;
        }
        stdout(JSON.stringify(payload, null, 2));
        // skipped_kill_switch is an intentional no-op (kill switch engaged), not a failure —
        // only a real dispatch error should fail the exit code.
        return result.status === 'error' ? 1 : 0;
      }
      case 'pending-list': {
        const paths = flags.repeated.get('--from') ?? [];
        const single = optionalFlag(flags, '--from');
        const fromPaths = paths.length > 0 ? paths : single ? [single] : [];
        if (fromPaths.length === 0) {
          throw new Error(
            'pending-list requires --from path/to/obscurity-or-subjects.json (repeatable)',
          );
        }
        stdout(JSON.stringify(loadPendingEditorialItems(fromPaths), null, 2));
        return 0;
      }
      case 'capture-backfill': {
        // Anti-rot/anti-spoof: snapshot every cited URL. Safe by default (dry-run
        // inventory + coverage report); --commit performs SSRF-safe fetches + writes.
        // --wayback POSTs successful captures to SPN2 when IA keys are present.
        // The availability lookup is wired unconditionally: it needs no credentials, and it
        // only fires under --commit, after a local fetch fails or before SPN mints a capture.
        const pool = deps.captureDb ?? getOpsPostgresPool(process.env);
        const commit = flags.booleans.has('--commit');
        const wayback = flags.booleans.has('--wayback');
        const maxRaw = optionalFlag(flags, '--max-captures');
        const maxCaptures = maxRaw === undefined ? undefined : Number(maxRaw);
        if (maxCaptures !== undefined && (!Number.isSafeInteger(maxCaptures) || maxCaptures < 0)) {
          throw new Error('--max-captures must be a non-negative integer');
        }
        const maxEntitiesRaw = optionalFlag(flags, '--max-entities');
        const maxEntities = maxEntitiesRaw === undefined ? undefined : Number(maxEntitiesRaw);
        if (maxEntities !== undefined && (!Number.isSafeInteger(maxEntities) || maxEntities < 0)) {
          throw new Error('--max-entities must be a non-negative integer');
        }
        const targetUrl = optionalFlag(flags, '--url');
        const afterUrl = optionalFlag(flags, '--after-url');
        const inventoryFingerprint = optionalFlag(flags, '--inventory-fingerprint');
        const decisionsPath = optionalFlag(flags, '--preservation-decisions');
        const values: unknown = decisionsPath ? JSON.parse(readFile(decisionsPath)) : [];
        if (!Array.isArray(values)) throw new Error('--preservation-decisions requires an array');
        const decisions = values.map((value) => assertContract('PreservationDecision', value));
        const fetchDependencies = deps.fetchDependencies ?? createNodeSafeFetchDependencies();
        const waybackCredentials = wayback ? waybackCredentialsFromEnv(process.env) : undefined;
        const captureDeps: CaptureDeps = {
          fetchUrl: (url) => runQuickAddFetch(url, fetchDependencies),
          storage: captureStorageFromEnv(process.env, decisions),
          parserVersion: 'capture-backfill-v1',
          newId: (prefix, seed) =>
            `${prefix}_${createHash('sha1').update(seed).digest('hex').slice(0, 16)}`,
          now: () => new Date().toISOString(),
          waybackLookup: createWaybackLookup({ client: waybackSafeHttpClient }),
          ...(waybackCredentials
            ? {
                waybackAnchor: createWaybackAnchor({
                  client: waybackSafeHttpClient,
                  decisionForUrl: (url) => decisions.find((decision) => decision.sourceUrl === url),
                  jobs: createPostgresWaybackJobStore(pool),
                  credentials: waybackCredentials,
                  now: () => new Date().toISOString(),
                }),
              }
            : {}),
        };
        const report = await runCaptureBackfill(
          pool,
          {
            commit,
            ...(maxCaptures !== undefined ? { maxCaptures } : {}),
            ...(maxEntities !== undefined ? { maxEntities } : {}),
            ...(targetUrl !== undefined ? { targetUrl } : {}),
            ...(afterUrl !== undefined ? { afterUrl } : {}),
            ...(inventoryFingerprint !== undefined ? { inventoryFingerprint } : {}),
            ...(wayback ? { wayback: true } : {}),
          },
          captureDeps,
        );
        stdout(JSON.stringify({ command: 'capture-backfill', ...report }, null, 2));
        return 0;
      }
      case 'editorial-run':
      case 'enrichment-run': {
        const subjectsPath = requireFlag(flags, '--subjects');
        const catalogPath = optionalFlag(flags, '--catalog');
        const catalogFrom = optionalFlag(flags, '--catalog-from');
        const subjectsJson = JSON.parse(readFile(subjectsPath)) as
          | {
              subjects?: EditorialSubjectFile[];
            }
          | EditorialSubjectFile[];
        const subjects = Array.isArray(subjectsJson) ? subjectsJson : (subjectsJson.subjects ?? []);
        if (subjects.length === 0) {
          throw new Error('--subjects must be a JSON array or { subjects: [...] }');
        }
        const catalogRaw = catalogPath ? JSON.parse(readFile(catalogPath)) : undefined;
        const jsonCatalogEntries: EditorialCatalogEntity[] = Array.isArray(catalogRaw)
          ? (catalogRaw as EditorialCatalogEntity[])
          : Array.isArray((catalogRaw as { entities?: unknown } | undefined)?.entities)
            ? (catalogRaw as { entities: EditorialCatalogEntity[] }).entities
            : [];
        let catalogEntries: EditorialCatalogEntity[] =
          jsonCatalogEntries.length > 0
            ? jsonCatalogEntries
            : subjects.map((subject) => ({
                id: subject.subjectId,
                displayName: subject.title,
              }));
        if (catalogFrom === 'postgres') {
          assertPostgresOpsDataSource(process.env);
          const postgresCatalog = await loadEditorialCatalogFromPostgres();
          catalogEntries =
            jsonCatalogEntries.length > 0
              ? mergeJsonCatalogOverCanonical(postgresCatalog, jsonCatalogEntries)
              : postgresCatalog.length > 0
                ? postgresCatalog
                : catalogEntries;
        } else if (catalogFrom !== undefined) {
          throw editorialCatalogFromError(catalogFrom);
        }
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          'mock' | 'openrouter' | 'ollama' | 'hybrid';
        if (!['mock', 'openrouter', 'ollama', 'hybrid'].includes(providerName)) {
          throw new Error('--provider must be mock|openrouter|ollama|hybrid');
        }
        const ollamaModel = optionalFlag(flags, '--ollama-model');
        const model =
          optionalFlag(flags, '--model') ?? defaultModelForProvider(providerName, ollamaModel);
        const concurrencyRaw = optionalFlag(flags, '--concurrency');
        const concurrency = concurrencyRaw !== undefined ? Number(concurrencyRaw) : 1;
        if (!Number.isFinite(concurrency) || concurrency < 1) {
          throw new Error('--concurrency must be a positive number');
        }
        const provider = createLlmProvider({
          provider: providerName,
          model,
          ...(ollamaModel !== undefined ? { ollamaModel } : {}),
        });
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const identity = readOperatorIdentity(flags);
        const outputPath = optionalFlag(flags, '--output');
        const progressPath = outputPath ? `${outputPath}.progress.ndjson` : undefined;
        if (progressPath) {
          writeFile(progressPath, '');
        }
        const runInput = {
          subjects: subjects.map((subject) => ({
            subjectId: subject.subjectId,
            title: subject.title,
            ...(subject.kind !== undefined ? { kind: subject.kind } : {}),
            ...(subject.existingSummary !== undefined
              ? { existingSummary: subject.existingSummary }
              : {}),
            ...(subject.existingContext !== undefined
              ? { existingContext: subject.existingContext }
              : {}),
            ...(subject.sourceSnippets !== undefined
              ? { sourceSnippets: subject.sourceSnippets }
              : {}),
          })),
          catalog: catalogEntries.map((entry) => ({
            id: entry.id,
            displayName: entry.displayName,
            ...(entry.aliases !== undefined ? { aliases: entry.aliases } : {}),
            ...(entry.vector !== undefined ? { vector: entry.vector } : {}),
          })),
          identity,
          nowIso,
          provider,
          concurrency,
          model,
          onProgress: (event: EditorialProgressEvent) => {
            emitEditorialProgress({
              event,
              stderr,
              appendFile,
              ...(progressPath !== undefined ? { progressPath } : {}),
            });
          },
        };
        const result =
          command === 'enrichment-run'
            ? await runEnrichmentJudge(runInput)
            : await runEditorialJudge(runInput);
        if (flags.booleans.has('--commit')) {
          const pepper = optionalFlag(flags, '--privacy-pepper') ?? requirePepperFromEnv();
          const context = {
            identity,
            privacyPepper: pepper,
            nowMs: deps.nowMs ?? Date.now(),
          };
          const commits = [];
          for (const item of result.items) {
            if (item.packet.decision === 'reject') continue;
            commits.push(
              await finish(prepareEditorialPacketIntake(item.packet, context), flags, deps),
            );
          }
          emitRunJson({
            payload: { result, commits },
            flags,
            stdout,
            writeFile,
          });
          return 0;
        }
        emitRunJson({
          payload: result,
          flags,
          stdout,
          writeFile,
        });
        return 0;
      }
      case 'story-research-run': {
        const topicsPath = requireFlag(flags, '--topics');
        const topicsJson = JSON.parse(readFile(topicsPath)) as
          | {
              topics?: StoryTopicSeed[];
            }
          | StoryTopicSeed[];
        const topics = Array.isArray(topicsJson) ? topicsJson : (topicsJson.topics ?? []);
        if (topics.length === 0) {
          throw new Error('--topics must be a JSON array or { topics: [...] }');
        }
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          'mock' | 'openrouter' | 'ollama' | 'hybrid';
        if (!['mock', 'openrouter', 'ollama', 'hybrid'].includes(providerName)) {
          throw new Error('--provider must be mock|openrouter|ollama|hybrid');
        }
        const model = optionalFlag(flags, '--model');
        const ollamaModel = optionalFlag(flags, '--ollama-model');
        const provider = createLlmProvider({
          provider: providerName,
          ...(model !== undefined ? { model } : {}),
          ...(ollamaModel !== undefined ? { ollamaModel } : {}),
        });
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const identity = readOperatorIdentity(flags);
        const result = await runStoryResearch({
          topics,
          identity,
          nowIso,
          provider,
          ...(model !== undefined ? { model } : {}),
        });
        if (flags.booleans.has('--commit')) {
          const pepper = optionalFlag(flags, '--privacy-pepper') ?? requirePepperFromEnv();
          const context = {
            identity,
            privacyPepper: pepper,
            nowMs: deps.nowMs ?? Date.now(),
          };
          const commits = [];
          for (const item of result.items) {
            if (item.packet.decision === 'reject') continue;
            commits.push(await finish(prepareStoryPacketIntake(item.packet, context), flags, deps));
          }
          stdout(JSON.stringify({ result, commits }, null, 2));
          return 0;
        }
        stdout(JSON.stringify(result, null, 2));
        return 0;
      }
      case 'sundown-town-brief': {
        const state = requireFlag(flags, '--state');
        const county = optionalFlag(flags, '--county');
        const limit = Number(optionalFlag(flags, '--limit') ?? '25');
        const geojsonResult = await runQuickAddFetch(
          TOUGALOO_GEOJSON_URL,
          deps.fetchDependencies ?? createNodeSafeFetchDependencies(),
        );
        if (!geojsonResult.ok) {
          throw new Error(`Could not fetch Tougaloo GeoJSON (${geojsonResult.reason})`);
        }
        const features = await loadTougalooGeojsonFeatures(async () =>
          JSON.parse(geojsonResult.parser.extractedText),
        );
        const result = await runSundownTownCountyBrief(
          {
            state,
            ...(county ? { county } : {}),
            limit,
          },
          features,
          {
            dependencies: deps.fetchDependencies ?? createNodeSafeFetchDependencies(),
          },
        );
        stdout(JSON.stringify(result, null, 2));
        return 0;
      }
      case 'harness-run': {
        const theme = requireFlag(flags, '--theme');
        const metro = optionalFlag(flags, '--metro') ?? 'unspecified';
        const maxSubjects = Number(optionalFlag(flags, '--max-subjects') ?? '25');
        const maxRelations = Number(optionalFlag(flags, '--max-relations') ?? '25');
        if (
          maxSubjects < 1 ||
          ![maxSubjects, maxRelations].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100)
        ) {
          throw new Error('Harness limits must be integers: subjects 1-100, relations 0-100');
        }
        const subjectsPath = optionalFlag(flags, '--subjects');
        const harnessProgressPath = optionalFlag(flags, '--progress-path');
        if (harnessProgressPath) writeFile(harnessProgressPath, '');
        const reportHarnessProgress = (line: Readonly<Record<string, unknown>>): void => {
          emitHarnessProgress({
            line,
            stderr,
            appendFile,
            ...(harnessProgressPath !== undefined ? { progressPath: harnessProgressPath } : {}),
          });
        };
        const connectorList = (optionalFlag(flags, '--connectors') ?? '')
          .split(',')
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean);
        if (
          connectorList.some((c) => !['dpla', 'nps_network_to_freedom', 'web_search'].includes(c))
        ) {
          throw new Error('Unknown harness connector');
        }
        const query = optionalFlag(flags, '--query') ?? theme;
        const urlToScrape = optionalFlag(flags, '--url');

        reportHarnessProgress({
          stage: 'start',
          theme,
          metro,
          connectors: connectorList,
        });

        let rawSubjects: HarnessRawSubject[] = [];
        if (subjectsPath) {
          const supplied: unknown = JSON.parse(readFile(subjectsPath));
          if (!Array.isArray(supplied))
            throw new Error('--subjects must contain an array of source records');
          rawSubjects = supplied.map((record) => assertContract('HarnessSourceRecord', record));
        }
        if (!subjectsPath && !urlToScrape && connectorList.length === 0) {
          throw new Error(
            'Supply --subjects, --url, or an explicit --connectors selection; example data is never injected',
          );
        }

        // 1. Live crawl / scrape if URL supplied
        if (urlToScrape) {
          const fetchResult = await runQuickAddFetch(
            urlToScrape,
            deps.fetchDependencies ?? createNodeSafeFetchDependencies(),
          );
          if (fetchResult.ok) {
            const text = fetchResult.parser.extractedText;
            const firstLine = text.split(/(?<=[.!?])\s|\n/u)[0]?.trim() ?? '';
            const title = firstLine.slice(0, 80) || 'Scraped Live Page';
            rawSubjects.push({
              id: `scraped:${createHash('sha256').update(urlToScrape).digest('hex').slice(0, 24)}`,
              connectorKind: 'web_page',
              title: title.trim(),
              description: text.trim().slice(0, 1200),
              cites: [urlToScrape],
              rawRecord: {
                scrapedUrl: urlToScrape,
                fullTextLength: text.length,
                textTruncated: text.trim().length > 1200,
              },
            });
          } else {
            stderr(`Failed to scrape live URL "${urlToScrape}": ${fetchResult.reason}\n`);
          }
        }

        if (connectorList.includes('nps_network_to_freedom')) {
          const csvPath = requireFlag(flags, '--nps-csv');
          rawSubjects.push(...fetchNpsNetworkToFreedom(readFile(csvPath), { limit: maxSubjects }));
        }

        if (connectorList.includes('dpla')) {
          const dplaPath = requireFlag(flags, '--dpla-json');
          const records: unknown = JSON.parse(readFile(dplaPath));
          if (!Array.isArray(records))
            throw new Error('--dpla-json must contain an array of DPLA records');
          rawSubjects.push(...fetchDplaItems(records, { query, limit: maxSubjects }));
        }

        if (connectorList.includes('web_search')) {
          // A search result is a LEAD, and the enrichment bridge turns a subject's `cites` into
          // citationUrl and its `description` into the text claims are drawn from. So a lead must
          // be fetched through safe-fetch before it can become a subject at all: only a page that
          // answered becomes one, carrying the text that was actually read and the URL that
          // actually served it.
          const searchQuery =
            optionalFlag(flags, '--query') ??
            [theme, metro === 'unspecified' ? '' : metro].filter(Boolean).join(' ');
          try {
            const searchResult = await runSearchQueries({
              queries: [{ query: searchQuery, seeking: 'source for the research question' }],
              environment: process.env,
              executedAt: new Date().toISOString(),
              maxLeadsPerQuery: 5,
              ...(deps.searchProvider !== undefined ? { resolved: deps.searchProvider } : {}),
            });
            if (!searchResult.available) {
              reportHarnessProgress({
                stage: 'web_search.unavailable',
                reason: searchResult.reason,
              });
            } else {
              reportHarnessProgress({
                stage: 'web_search.leads',
                servedBy: searchResult.provider,
                leadCount: searchResult.leads.length,
                duplicatePagesDropped: searchResult.duplicateLeadsDropped,
                skipped: searchResult.skipped.length,
                budgetEnforced: searchResult.budgetEnforced,
                note: describeRoutedSearch(searchResult),
              });
              // The gather step is the boundary. Anything a lead promised and the page does not
              // deliver is dropped here rather than downstream.
              const gathered = await gatherSourceSnippetsFromUrls(
                searchResult.leads.map((lead) => lead.url),
                deps.fetchDependencies !== undefined
                  ? { dependencies: deps.fetchDependencies }
                  : {},
              );
              const leadByUrl = new Map(searchResult.leads.map((lead) => [lead.url, lead]));
              reportHarnessProgress({
                stage: 'web_search.fetched',
                leadCount: searchResult.leads.length,
                fetchedCount: gathered.length,
                droppedUnfetchable: searchResult.leads.length - gathered.length,
                // Which URLs became subjects, and that the text came from the page rather than the
                // engine. Counts alone make a reverted mapping invisible: putting the blurb back in
                // `description` changes no count.
                citedUrls: gathered.map((snippet) => snippet.finalUrl ?? snippet.url),
                descriptionSource: 'fetched_page',
              });
              // A subject is built from the FETCHED page and nothing else. The engine's title and
              // blurb are its output rather than the document's, they carry no retrieval
              // provenance, and this record is written to the run JSON and the progress file —
              // which is persistence, whatever the storage-rights flag says. So neither string
              // appears here, not even labeled: a label does not stop a write.
              const webSubjects: HarnessRawSubject[] = gathered.map((snippet) => {
                const lead = leadByUrl.get(snippet.url);
                const citedUrl = snippet.finalUrl ?? snippet.url;
                return {
                  id: `web:${createHash('sha256').update(citedUrl).digest('hex').slice(0, 24)}`,
                  connectorKind: 'web_search',
                  title: deriveSuggestedTitle(snippet.text),
                  description: snippet.excerpt,
                  // The URL that actually answered, after any redirect.
                  cites: [citedUrl],
                  rawRecord: {
                    servedBy: searchResult.provider,
                    // Our own query, our own URLs. No engine prose.
                    queryText: lead?.queryText ?? searchQuery,
                    leadUrl: snippet.url,
                    fetchedUrl: citedUrl,
                  },
                };
              });
              rawSubjects = [...rawSubjects, ...webSubjects];
            }
          } catch (err) {
            stderr(`Warning: Web search failed: ${String(err)}\n`);
          }
        }

        reportHarnessProgress({
          stage: 'connectors.complete',
          rawSubjectsCount: rawSubjects.length,
          connectorKinds: [...new Set(rawSubjects.map((s) => s.connectorKind))],
        });

        // Stable ids deduplicate fetched/supplied records. Names alone never resolve identity.
        rawSubjects = rawSubjects.map((subject) => assertContract('HarnessSourceRecord', subject));
        const byId = new Map<string, HarnessRawSubject>();
        for (const subject of rawSubjects) {
          const prior = byId.get(subject.id);
          if (prior && JSON.stringify(prior) !== JSON.stringify(subject))
            throw new Error(`Conflicting source records share id ${subject.id}`);
          byId.set(subject.id, subject);
        }
        rawSubjects = [...byId.values()];
        const deferredSubjects = Math.max(0, rawSubjects.length - maxSubjects);
        const deduplicatedSubjects = rawSubjects.slice(0, maxSubjects);

        const overlaps = findRelationshipCandidates(deduplicatedSubjects, {
          maxDistanceMeters: 10000,
        }).slice(0, maxRelations);

        reportHarnessProgress({
          stage: 'dedup.complete',
          rawSubjectsCount: deduplicatedSubjects.length,
          deferredSubjects,
          overlapsCount: overlaps.length,
        });

        type EnrichmentFailure = {
          readonly id: string;
          readonly error: string;
          readonly rawOutput?: string;
        };
        type RelationFailure = {
          readonly subjectAId: string;
          readonly subjectBId: string;
          readonly error: string;
          readonly rawOutput?: string;
        };
        const enrichedCandidates: Array<EnrichedCandidate | EnrichmentFailure> = [];
        const adjudicatedRelations: Array<AdjudicatedRelationship | RelationFailure> = [];

        if (flags.booleans.has('--enrich')) {
          const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
            'mock' | 'openrouter' | 'ollama' | 'hybrid';
          const model = optionalFlag(flags, '--model');
          const ollamaModel = optionalFlag(flags, '--ollama-model');

          const provider = createLlmProvider({
            provider: providerName,
            ...(model !== undefined ? { model } : {}),
            ...(ollamaModel !== undefined ? { ollamaModel } : {}),
          });

          const bridgeClient: EnrichmentBridgeClient = {
            complete: async (prompt, schemaName, schema) => {
              const res = await provider.complete({
                model: model ?? '',
                messages: [{ role: 'user', content: prompt }],
                responseSchema: { name: schemaName, schema },
              });
              return res.content;
            },
          };

          for (const [index, subject] of deduplicatedSubjects.entries()) {
            try {
              const candidate = await enrichSubjectCandidate(subject, bridgeClient, theme, metro);
              enrichedCandidates.push(candidate);
              reportHarnessProgress({
                stage: 'enrich.subject',
                index: index + 1,
                total: deduplicatedSubjects.length,
                subjectId: subject.id,
                title: subject.title,
                ok: true,
              });
            } catch (err) {
              enrichedCandidates.push({
                id: subject.id,
                error: String(err),
                ...(err instanceof InvalidHarnessOutputError ? { rawOutput: err.rawOutput } : {}),
              });
              reportHarnessProgress({
                stage: 'enrich.subject',
                index: index + 1,
                total: deduplicatedSubjects.length,
                subjectId: subject.id,
                title: subject.title,
                ok: false,
                error: String(err).slice(0, 240),
              });
            }
          }

          for (const [index, overlap] of overlaps.entries()) {
            try {
              const relation = await adjudicateRelationship(overlap, bridgeClient, theme, metro);
              adjudicatedRelations.push(relation);
              reportHarnessProgress({
                stage: 'adjudicate.relationship',
                index: index + 1,
                total: overlaps.length,
                subjectAId: overlap.subjectA.id,
                subjectBId: overlap.subjectB.id,
                ok: true,
              });
            } catch (err) {
              adjudicatedRelations.push({
                subjectAId: overlap.subjectA.id,
                subjectBId: overlap.subjectB.id,
                error: String(err),
                ...(err instanceof InvalidHarnessOutputError ? { rawOutput: err.rawOutput } : {}),
              });
              reportHarnessProgress({
                stage: 'adjudicate.relationship',
                index: index + 1,
                total: overlaps.length,
                subjectAId: overlap.subjectA.id,
                subjectBId: overlap.subjectB.id,
                ok: false,
                error: String(err).slice(0, 240),
              });
            }
          }
        }

        reportHarnessProgress({
          stage: 'done',
          rawSubjectsCount: deduplicatedSubjects.length,
          overlapsCount: overlaps.length,
          enrichedCount: enrichedCandidates.length,
          adjudicatedCount: adjudicatedRelations.length,
        });

        const successfulAdjudications = adjudicatedRelations.filter(
          (entry): entry is AdjudicatedRelationship => !('error' in entry),
        );

        let stagedHarnessRelations: Awaited<
          ReturnType<typeof stageHarnessAdjudicatedRelationships>
        > = [];
        if (flags.booleans.has('--commit') && successfulAdjudications.length > 0) {
          const pool = getOpsPostgresPool(process.env);
          const client = await pool.connect();
          const runId = `harness-adjudication-${theme}-${Date.now()}`;
          try {
            await client.query('BEGIN');
            await ensureSourceProgramRun(
              client,
              runId,
              HARNESS_ADJUDICATION_PROGRAM_ID,
              'Harness spatiotemporal relationship adjudicator',
              { theme, metro, adjudicatedCount: successfulAdjudications.length },
              successfulAdjudications.length,
              'other',
            );
            stagedHarnessRelations = await stageHarnessAdjudicatedRelationships(
              successfulAdjudications,
              runId,
              theme,
              metro,
              async (rows) => {
                await insertLandscapeCandidateRows(client, rows);
              },
            );
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            client.release();
          }
        }

        const result = {
          theme,
          metro,
          connectorList,
          deferredSubjects,
          limits: { maxSubjects, maxRelations },
          confidenceMeaning: 'uncalibrated_model_self_report',
          disposition: 'proposals_require_independent_review',
          rawSubjectsCount: deduplicatedSubjects.length,
          rawSubjects: deduplicatedSubjects,
          overlapsCount: overlaps.length,
          overlaps,
          ...(flags.booleans.has('--enrich')
            ? {
                enrichedCandidates,
                adjudicatedRelations,
                ...(flags.booleans.has('--commit')
                  ? { stagedHarnessRelationsCount: stagedHarnessRelations.length }
                  : {}),
              }
            : {}),
        };

        stdout(JSON.stringify(result, null, 2));
        return 0;
      }
      case 'backfill-entity':
      case 'prose-run': {
        // Single-entity convenience wrapper over the same `runEnrichmentJudge` bridge
        // `enrichment-run`/`editorial-run` use (see that case above) — no separate judge,
        // provider setup, or output shape. `backfill-entity` re-runs enrichment for one
        // already-known entity id; `prose-run` is the lighter-weight prose verb documented in
        // docs/research/research-operations.md (short-form vs full `story-research-run`
        // packets). Both skip the `--subjects` file: build the one-subject input from flags.
        const entityId = requireFlag(flags, '--entity-id');
        const title = optionalFlag(flags, '--title') ?? entityId;
        const existingSummary = optionalFlag(flags, '--summary');
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          'mock' | 'openrouter' | 'ollama' | 'hybrid';
        if (!['mock', 'openrouter', 'ollama', 'hybrid'].includes(providerName)) {
          throw new Error('--provider must be mock|openrouter|ollama|hybrid');
        }
        const ollamaModel = optionalFlag(flags, '--ollama-model');
        const model =
          optionalFlag(flags, '--model') ?? defaultModelForProvider(providerName, ollamaModel);
        const provider = createLlmProvider({
          provider: providerName,
          model,
          ...(ollamaModel !== undefined ? { ollamaModel } : {}),
        });
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const identity = readOperatorIdentity(flags);
        const result = await runEnrichmentJudge({
          subjects: [
            {
              subjectId: entityId,
              title,
              ...(existingSummary ? { existingSummary } : {}),
            },
          ],
          catalog: [{ id: entityId, displayName: title }],
          identity,
          nowIso,
          provider,
          concurrency: 1,
          model,
          onProgress: () => {},
        });
        if (flags.booleans.has('--commit')) {
          const pepper = optionalFlag(flags, '--privacy-pepper') ?? requirePepperFromEnv();
          const context = { identity, privacyPepper: pepper, nowMs: deps.nowMs ?? Date.now() };
          const commits = [];
          for (const item of result.items) {
            if (item.packet.decision === 'reject') continue;
            commits.push(
              await finish(prepareEditorialPacketIntake(item.packet, context), flags, deps),
            );
          }
          stdout(JSON.stringify({ verb: command, entityId, result, commits }, null, 2));
          return 0;
        }
        stdout(JSON.stringify({ verb: command, entityId, result }, null, 2));
        return 0;
      }
      case 'expand': {
        const entityId = requireFlag(flags, '--entity-id');
        const depthRaw = Number(optionalFlag(flags, '--depth') ?? '1');
        const depth = depthRaw === 2 ? 2 : 1;
        const maxCandidates = Number(optionalFlag(flags, '--max-candidates') ?? '50');
        if (!Number.isFinite(maxCandidates) || maxCandidates < 1) {
          throw new Error('--max-candidates must be a positive number');
        }

        const pool = getOpsPostgresPool(process.env);
        const seed = await loadExpansionSeed(pool, entityId);
        const candidates = await expandEntityNetwork(seed, { depth, maxCandidates });

        if (flags.booleans.has('--commit')) {
          const client = await pool.connect();
          const runId = `expand-${entityId}-${Date.now()}`;
          try {
            await client.query('BEGIN');
            await ensureSourceProgramRun(
              client,
              runId,
              'wikidata-network-expansion',
              'Operator CLI expand verb',
              { entityId, depth, candidateCount: candidates.length },
              candidates.length,
            );
            const staged = await stageNetworkCandidates(seed, candidates, runId, async (rows) => {
              await insertLandscapeCandidateRows(client, rows);
            });
            await client.query('COMMIT');
            stdout(
              JSON.stringify(
                {
                  verb: 'expand',
                  entityId,
                  depth,
                  status: 'staged',
                  candidateCount: candidates.length,
                  stagedCount: staged.length,
                  seed,
                },
                null,
                2,
              ),
            );
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            client.release();
          }
          return 0;
        }

        stdout(
          JSON.stringify(
            {
              verb: 'expand',
              entityId,
              depth,
              status: 'dry_run',
              candidateCount: candidates.length,
              seed,
              candidates,
            },
            null,
            2,
          ),
        );
        return 0;
      }
      case 'graylist-read': {
        // Read path for parked/quarantined items — documented as missing in the
        // triage-graylist lane. Covers the Postgres-backed quarantine table
        // (submissions.intake_items, status='quarantined'); Postgres-backed
        // submissionInbox/discoveryCandidates (moderationState/status fields) are not yet
        // reachable from this CLI — see docs/research/research-operations.md ("graylist read
        // path") for that gap.
        const limitRaw = optionalFlag(flags, '--limit');
        const limit = limitRaw ? Number(limitRaw) : 50;
        if (!Number.isFinite(limit) || limit < 1) {
          throw new Error('--limit must be a positive number');
        }
        const pool = getOpsPostgresPool(process.env);
        const { rows } = await pool.query(
          `SELECT id, status, kind, source_url, created_at
             FROM submissions.intake_items
            WHERE status = 'quarantined'
            ORDER BY created_at DESC
            LIMIT $1`,
          [limit],
        );
        stdout(
          JSON.stringify(
            {
              verb: 'graylist-read',
              source: 'postgres:intake_items',
              count: rows.length,
              items: rows,
            },
            null,
            2,
          ),
        );
        return 0;
      }
      case 'quarantine-triage': {
        // Write path for the graylist: judges each quarantined submissions.intake_items
        // row with an LLM (see quarantine-triage.ts for the authority this does and does not
        // have) and, with --commit, moves it to promoted/rejected/spam.
        const limitRaw = optionalFlag(flags, '--limit');
        const limit = limitRaw ? Number(limitRaw) : 50;
        if (!Number.isFinite(limit) || limit < 1) {
          throw new Error('--limit must be a positive number');
        }
        const thresholdRaw = optionalFlag(flags, '--confidence-threshold');
        const confidenceThreshold = thresholdRaw ? Number(thresholdRaw) : 0.6;
        if (
          !Number.isFinite(confidenceThreshold) ||
          confidenceThreshold < 0 ||
          confidenceThreshold > 1
        ) {
          throw new Error('--confidence-threshold must be a number between 0 and 1');
        }
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          'mock' | 'openrouter' | 'ollama' | 'hybrid';
        const model = optionalFlag(flags, '--model');
        const provider = createLlmProvider({ provider: providerName, ...(model ? { model } : {}) });
        const pool = getOpsPostgresPool(process.env);
        const { rows } = await pool.query(
          `SELECT id, kind, payload, source_url, created_at
             FROM submissions.intake_items
            WHERE status = 'quarantined'
            ORDER BY created_at ASC
            LIMIT $1`,
          [limit],
        );
        const items: QuarantineIntakeItem[] = rows.map(
          (row: {
            id: string;
            kind: string | null;
            payload: unknown;
            source_url: string | null;
            created_at: Date | string;
          }) => ({
            id: row.id,
            kind: row.kind,
            payload: row.payload,
            sourceUrl: row.source_url,
            createdAt: new Date(row.created_at).toISOString(),
          }),
        );
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const progressPath = optionalFlag(flags, '--progress-path');
        if (progressPath) writeFile(progressPath, '');
        const shouldCommit = flags.booleans.has('--commit');
        const identity = shouldCommit ? readOperatorIdentity(flags) : undefined;
        const plans: QuarantineTriagePlan[] = [];
        const errors: Array<{ id: string; error: string }> = [];
        let committedCount = 0;
        let skippedAlreadyProcessed = 0;
        for (const [index, item] of items.entries()) {
          const startedAt = Date.now();
          let outcome: 'judged' | 'error' = 'judged';
          let plan: QuarantineTriagePlan | undefined;
          let errorMessage: string | undefined;
          try {
            const judgment = await judgeQuarantineItem({ item, provider, model: model ?? '' });
            plan = prepareQuarantineTriageDecision(item, judgment, { confidenceThreshold, nowIso });
            plans.push(plan);
          } catch (error) {
            outcome = 'error';
            errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({ id: item.id, error: errorMessage });
          }
          let committedThisItem = false;
          if (plan && shouldCommit && identity) {
            const result = await commitQuarantineTriagePlans(pool, [plan], identity, nowIso);
            committedCount += result.committed;
            skippedAlreadyProcessed += result.skippedAlreadyProcessed.length;
            committedThisItem = result.committed > 0;
          }
          emitQuarantineTriageProgress({
            line: {
              completed: index + 1,
              total: items.length,
              intakeItemId: item.id,
              outcome,
              ...(plan ? { decision: plan.effectiveDecision } : {}),
              ...(plan ? { confidence: plan.judgment.confidence } : {}),
              ...(errorMessage ? { error: errorMessage.slice(0, 240) } : {}),
              committed: committedThisItem,
              elapsedMs: Date.now() - startedAt,
            },
            stderr,
            appendFile,
            ...(progressPath !== undefined ? { progressPath } : {}),
          });
        }
        const commitSummary = shouldCommit
          ? { committed: committedCount, skippedAlreadyProcessed }
          : undefined;
        const counts = plans.reduce<Record<string, number>>((acc, plan) => {
          acc[plan.effectiveDecision] = (acc[plan.effectiveDecision] ?? 0) + 1;
          return acc;
        }, {});
        stdout(
          JSON.stringify(
            {
              verb: 'quarantine-triage',
              fetched: items.length,
              judged: plans.length,
              errors,
              counts,
              committed: shouldCommit,
              commitSummary,
              plans: plans.map((plan) => ({
                intakeItemId: plan.intakeItemId,
                decision: plan.effectiveDecision,
                confidence: plan.judgment.confidence,
                rationale: plan.judgment.rationale,
                researchCaseId: plan.write?.caseWrite?.record.id,
              })),
            },
            null,
            2,
          ),
        );
        return errors.length > 0 && plans.length === 0 ? 1 : 0;
      }
      case 'locate': {
        const storedLat = optionalFlag(flags, '--stored-lat');
        const storedLng = optionalFlag(flags, '--stored-lng');
        const jurisdictionLabel = optionalFlag(flags, '--jurisdiction');
        const locationPrecision = optionalFlag(flags, '--precision');
        const locationId = optionalFlag(flags, '--location-id');
        const role = optionalFlag(flags, '--role') as
          'historical' | 'current' | 'approximate' | undefined;
        const outcome = await prepareLocate(
          {
            entityId: requireFlag(flags, '--entity-id'),
            address: requireFlag(flags, '--address'),
            ...(jurisdictionLabel ? { jurisdictionLabel } : {}),
            ...(locationPrecision ? { locationPrecision } : {}),
            ...(locationId ? { locationId } : {}),
            ...(role ? { role } : {}),
            ...(storedLat && storedLng
              ? { stored: { lat: Number(storedLat), lng: Number(storedLng) } }
              : {}),
          },
          { client: censusSafeHttpClient },
        );
        if (!outcome.ok) {
          stdout(JSON.stringify(outcome, null, 2));
          return 1;
        }
        let committed: unknown;
        if (flags.booleans.has('--commit')) {
          const store = deps.store ?? (await (deps.createLiveStore ?? createDefaultLiveStore)());
          committed = await commitLocate(store, {
            outcome,
            identity: readOperatorIdentity(flags),
          });
        }
        stdout(
          JSON.stringify(
            {
              ok: true,
              queryText: outcome.queryText,
              cacheKey: outcome.cacheKey,
              decision: outcome.decision,
              location: outcome.location,
              committed: committed ?? false,
            },
            null,
            2,
          ),
        );
        return 0;
      }
      case 'enrich-entity': {
        // Deficit planning and acquisition share the durable research protocol. Review owns maturity.
        assertPostgresOpsDataSource(process.env);
        const entityId = requireFlag(flags, '--entity-id');
        const targetRaw = optionalFlag(flags, '--target-maturity') ?? 'corroborated';
        if (!(RESEARCH_MATURITY_STATES as readonly string[]).includes(targetRaw)) {
          throw new Error(
            `--target-maturity must be one of ${RESEARCH_MATURITY_STATES.join(', ')}`,
          );
        }
        const targetMaturity = targetRaw as ResearchMaturity;
        const pool = getOpsPostgresPool(process.env);
        const { rows } = await pool.query(
          `SELECT re.entity_id, re.kind, re.display_name, re.summary,
                  COALESCE(re.claims, '[]'::jsonb) AS claims
             FROM published.release_entities re
             JOIN published.active_release ar ON ar.release_id = re.release_id
            WHERE re.entity_id = $1`,
          [entityId],
        );
        const row = rows[0];
        if (row === undefined) throw new Error(`No released entity ${entityId}`);
        const released = {
          entityId: String(row.entity_id),
          kind: String(row.kind),
          displayName: String(row.display_name ?? entityId),
          summary: (row.summary as string | null) ?? null,
          claims: (row.claims as ReleasedClaim[]) ?? [],
        };
        const releasedSnapshot = snapshotForReleasedEntity(released);
        const releasedAssessment = assessResearchMaturity({
          record: releasedSnapshot,
          identityResolved: true,
        });
        const reviewed = await assessReviewedMaturity(pool, released);
        const assessment = reviewed.assessment;
        // Review controls the maturity state. Projection-only deficits still fund acquisition:
        // otherwise a record with zero reviewed assignments would have too little information
        // to describe the evidence it needs to earn its first reviewed assignment.
        const planningDeficits = [...assessment.evidenceDeficits];
        const plannedDeficitKeys = new Set(
          planningDeficits.map((deficit) => `${deficit.code}:${deficit.claimId ?? ''}`),
        );
        for (const deficit of releasedAssessment.evidenceDeficits) {
          const key = `${deficit.code}:${deficit.claimId ?? ''}`;
          if (!plannedDeficitKeys.has(key)) planningDeficits.push(deficit);
        }
        const plan = planEnrichment({
          entityId: released.entityId,
          currentMaturity: assessment.maturity,
          targetMaturity,
          deficits: planningDeficits,
          context: { subjectName: released.displayName },
        });
        const runId = optionalFlag(flags, '--run-id');
        const decisionsPath = optionalFlag(flags, '--preservation-decisions');
        const decisions: PreservationDecision[] = decisionsPath
          ? (JSON.parse(readFile(decisionsPath)) as unknown[]).map((value) =>
              assertContract('PreservationDecision', value),
            )
          : [];
        const executionPlan = runId
          ? validateExecutionPlan(
              enrichmentExecutionPlan({
                plan,
                profile: blackHistoryProfile,
                runId,
                now: new Date().toISOString(),
                decisions,
                subjectName: released.displayName,
              }),
            )
          : null;
        let execution: Awaited<ReturnType<typeof runResearchWorker>> | null = null;
        if (flags.booleans.has('--commit')) {
          if (!executionPlan) throw new Error('enrich-entity --commit requires --run-id');
          const workerId = requireFlag(flags, '--worker-id');
          const maxTasks = Number(requireFlag(flags, '--max-tasks'));
          if (!Number.isSafeInteger(maxTasks) || maxTasks < 1 || maxTasks > 100)
            throw new Error('--max-tasks must be between 1 and 100');
          await startResearchExecution(pool, executionPlan);
          execution = await runResearchWorker(pool, {
            runId: executionPlan.run.id,
            workerId,
            maxTasks,
          });
        }
        const outputPath = optionalFlag(flags, '--output');
        if (outputPath && executionPlan)
          writeFile(outputPath, JSON.stringify(executionPlan, null, 2));
        stdout(
          JSON.stringify(
            {
              verb: 'enrich-entity',
              status: execution ? 'execution-attempted' : 'planned',
              executed: execution !== null,
              execution,
              executionPlan,
              publicationAuthorized: false,
              entityId: released.entityId,
              displayName: released.displayName,
              maturity: assessment.maturity,
              releasedProjectionMaturity: releasedAssessment.maturity,
              reviewedEvidence: {
                assignmentIds: reviewed.reviewedAssignmentIds,
                openMandatoryNeeds: reviewed.openMandatoryNeeds,
              },
              targetMaturity,
              targetIsAbove: targetIsAbove(assessment.maturity, targetMaturity),
              priority: assessment.priority,
              summary: describePlan(plan),
              blockersToNextState: blockersToNextState(assessment),
              plan,
            },
            null,
            2,
          ),
        );
        return execution?.attempts.some((attempt) => !attempt.valid) ? 1 : 0;
      }
      case 'research-quality-audit': {
        // Read-only. No --commit exists and none should: this measures the released catalog,
        // it never changes it. See research-quality-audit.ts for why the source-class mapping
        // is a heuristic and which way it errs.
        const releaseFlag = optionalFlag(flags, '--release-id');
        const kindFilter = optionalFlag(flags, '--kind');
        const entityFilter = optionalFlag(flags, '--entity-id');
        const deficitFilter = optionalFlag(flags, '--deficit');
        const limitRaw = optionalFlag(flags, '--limit');
        const limit = limitRaw ? Number(limitRaw) : undefined;
        if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
          throw new Error('--limit must be a positive number');
        }
        const pool = getOpsPostgresPool(process.env);
        const releaseId =
          releaseFlag ??
          (await pool.query('SELECT release_id FROM published.active_release LIMIT 1')).rows[0]
            ?.release_id;
        if (releaseId === undefined) throw new Error('No active release and no --release-id given');

        const conditions = ['release_id = $1'];
        const params: unknown[] = [releaseId];
        if (kindFilter !== undefined) {
          params.push(kindFilter);
          conditions.push(`kind = $${params.length}`);
        }
        if (entityFilter !== undefined) {
          params.push(entityFilter);
          conditions.push(`entity_id = $${params.length}`);
        }
        let sql = `SELECT entity_id, kind, display_name, summary, COALESCE(claims, '[]'::jsonb) AS claims
             FROM published.release_entities
            WHERE ${conditions.join(' AND ')}
            ORDER BY entity_id`;
        // A bounded --deficit cohort has to be picked from the WHOLE matching set, not from a
        // pre-filter slice of it -- so --limit is applied at the SQL level only when there is
        // no --deficit to filter by. With --deficit, the audit below runs over every row and
        // selectDeficitCohort applies the limit after filtering and prioritizing.
        if (limit !== undefined && deficitFilter === undefined) {
          params.push(limit);
          sql += ` LIMIT $${params.length}`;
        }
        const { rows } = await pool.query(sql, params);
        const entities = rows.map((row: Record<string, unknown>) => ({
          entityId: String(row.entity_id),
          kind: String(row.kind),
          displayName: String(row.display_name ?? ''),
          summary: (row.summary as string | null) ?? null,
          claims: (row.claims as ReleasedClaim[]) ?? [],
        }));
        // Per-entity rows are returned when the caller narrowed the query; a full-catalog run
        // reports distributions, because 4,000 rows of JSON is not a report.
        const includeEntities =
          entityFilter !== undefined || deficitFilter !== undefined || limit !== undefined;
        const report = auditReleasedEntities(String(releaseId), entities, { includeEntities });
        const filtered =
          deficitFilter !== undefined && report.entities !== undefined
            ? {
                ...report,
                entities: selectDeficitCohort(report.entities, deficitFilter as never, limit),
              }
            : report;
        stdout(JSON.stringify(filtered, null, 2));
        return 0;
      }
      default: {
        stderr(
          'Usage: operator-cli <research-run|research-work|research-status|research-claim|research-heartbeat|research-complete|research-index|research-embed|research-retrieve|capture-retention|preflight|model-report|submit-lead|research-intake|register-source|attach-evidence|bulk-import|propose-edge|discovery-run|community-obscurity-run|rss-campaign-run|discovery-dispatch|pending-list|editorial-run|enrichment-run|story-research-run|sundown-town-brief|harness-run|locate|backfill-entity|prose-run|expand|graylist-read|quarantine-triage|capture-backfill|research-quality-audit|enrich-entity> [flags]\n' +
            'Every command accepts --json (no-op: output is always JSON) and every id-bearing command uses --entity-id / --case-id for its target.\n' +
            'For model-report: [--since <ISO date>] [--json]\n' +
            'For harness-run: --theme <theme> [--metro <metro>] [--subjects <source-records.json> | --url <url> | --connectors dpla,nps_network_to_freedom,web_search] [--nps-csv <file>] [--dpla-json <file>] [--max-subjects 25] [--max-relations 25] [--enrich] [--provider openrouter|ollama|mock] [--progress-path <file>]\n' +
            'For backfill-entity/prose-run: --entity-id <id> [--title ...] [--summary ...] [--provider mock|openrouter|ollama|hybrid] [--commit]\n' +
            'For capture-backfill: [--commit] [--wayback] [--url CITED_URL | --max-captures N [--after-url URL --inventory-fingerprint SHA256] | --max-entities N]\n' +
            'For expand: --entity-id <id> [--depth N] [--commit] — live Wikidata traversal; stages landscape_candidates, never canonical\n' +
            'For enrich-entity: --entity-id <id> [--target-maturity seeded|grounded|corroborated|contextualized|deep_research|reference] [--run-id <id> --preservation-decisions <path> --worker-id <id> --max-tasks <n> --commit]\n' +
            'For research-quality-audit: [--release-id <id>] [--kind <kind>] [--entity-id <id>] [--deficit <code>] [--limit N] — read-only; narrow the query to get per-entity rows; --deficit with --limit returns the next N matching entities in priority order, not a deficit filter over the first N by id\n' +
            'For graylist-read: [--limit N] — Postgres quarantine only, see docs/research/research-operations.md\n',
        );
        return command ? 1 : 0;
      }
    }
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

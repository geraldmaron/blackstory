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
import type { RelationshipRole, RelationshipType } from '@repo/domain';
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
import type { DiscoveryRunBatch } from './discovery-run.js';
import { runBoundedDiscoveryCampaign } from './discovery-run.js';
import { runCommunityObscurityOperatorCampaign } from './community-obscurity-run.js';
import { runRssOperatorCampaign } from './rss-campaign-run.js';
import { dispatchDiscoveryCampaign } from '@repo/config/scheduled-jobs';
import { mergeJsonCatalogOverCanonical } from './editorial-catalog.js';
import { loadEditorialCatalogFromPostgres } from './editorial-catalog-postgres.js';
import {
  runEditorialJudge,
  type EditorialCatalogEntity,
  type EditorialProgressEvent,
} from './editorial-run.js';
import { prepareEditorialPacketIntake } from './editorial-intake.js';
import { runEnrichmentJudge } from './enrichment-run.js';
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
import { createNodeSafeFetchDependencies, runQuickAddFetch } from './fetch.js';
import { createMetadataOnlyStorage, type CaptureDeps } from './source-capture.js';
import { runCaptureBackfill, persistCapture } from './capture-backfill.js';
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
  findSpatialTemporalOverlaps,
  enrichSubjectCandidate,
  adjudicateRelationship,
  type HarnessRawSubject,
  type EnrichmentBridgeClient,
  type EnrichedCandidate,
  type AdjudicatedRelationship,
} from '@repo/research-harness';
import { assertPostgresOpsDataSource, editorialCatalogFromError } from './ops-data-source-gate.js';
import {
  buildBraveWebSearchUrl,
  parseBraveSearchResponse,
  buildSearxngSearchUrl,
  parseSearxngSearchResponse,
  type WebSearchRawResult,
} from '@repo/domain';

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
};

type Flags = {
  readonly values: Map<string, string>;
  readonly repeated: Map<string, string[]>;
  readonly booleans: Set<string>;
};

const REPEATABLE_FLAGS = new Set(['--source-url', '--feed-xml', '--from']);
const BOOLEAN_FLAGS = new Set([
  '--commit',
  '--continue-on-quarantine',
  '--enrich',
  '--full',
  '--include-curated',
  '--omit-raw-model',
  '--queue-survivors',
  // Accepted uniformly on every verb (repo-xez5.9): every command already prints JSON by
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
            storage: createMetadataOnlyStorage(),
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
        const result = await dispatchDiscoveryCampaign({
          jobId,
          mode: modeRaw,
          killSwitchEngaged: killRaw === 'engaged',
          nowIso,
          includeCampaign: queueSurvivors,
          ...(jobRunId !== undefined ? { jobRunId } : {}),
          ...(maxCandidatesRaw !== undefined ? { maxCandidates: Number(maxCandidatesRaw) } : {}),
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
        const pool = getOpsPostgresPool(process.env);
        const commit = flags.booleans.has('--commit');
        const maxRaw = optionalFlag(flags, '--max-captures');
        const maxCaptures = maxRaw === undefined ? undefined : Number.parseInt(maxRaw, 10);
        if (maxCaptures !== undefined && (!Number.isFinite(maxCaptures) || maxCaptures < 0)) {
          throw new Error('--max-captures must be a non-negative integer');
        }
        const fetchDependencies = deps.fetchDependencies ?? createNodeSafeFetchDependencies();
        const captureDeps: CaptureDeps = {
          fetchUrl: (url) => runQuickAddFetch(url, fetchDependencies),
          storage: createMetadataOnlyStorage(),
          parserVersion: 'capture-backfill-v1',
          newId: (prefix, seed) =>
            `${prefix}_${createHash('sha1').update(seed).digest('hex').slice(0, 16)}`,
          now: () => new Date().toISOString(),
        };
        const report = await runCaptureBackfill(
          pool,
          { commit, ...(maxCaptures !== undefined ? { maxCaptures } : {}) },
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
        const metro = requireFlag(flags, '--metro');
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
        const connectorList = (optionalFlag(flags, '--connectors') ?? 'dpla,nps_network_to_freedom')
          .split(',')
          .map((c) => c.trim().toLowerCase());
        const query = optionalFlag(flags, '--query') ?? theme;
        const urlToScrape = optionalFlag(flags, '--url');

        reportHarnessProgress({
          stage: 'start',
          theme,
          metro,
          connectors: connectorList,
        });

        let rawSubjects: HarnessRawSubject[] = [];

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
              id: `scraped:${Buffer.from(urlToScrape).toString('base64').slice(0, 12)}`,
              connectorKind: 'dpla',
              title: title.trim(),
              description: text.trim().slice(0, 1200),
              cites: [urlToScrape],
              rawRecord: { scrapedUrl: urlToScrape, fullTextLength: text.length },
            });
          } else {
            stderr(`Failed to scrape live URL "${urlToScrape}": ${fetchResult.reason}\n`);
          }
        }

        if (connectorList.includes('nps_network_to_freedom')) {
          reportHarnessProgress({
            stage: 'connector.mock_fixture',
            connectorKind: 'nps_network_to_freedom',
            note: 'hardcoded fixture rows, not a live NPS pull',
          });
          const csvData = `id,name,abstract,latitude,longitude,address,city,county,state,source_url
ntf-1,Chicago Quinn Chapel A.M.E. Church,"Historic church that served as an Underground Railroad station, active from 1847.",41.854,-87.625,"2401 S Wabash Ave",Chicago,Cook,Illinois,https://nps.gov/quinn-chapel
ntf-2,Dunbar High School,"Dunbar was established in 1870 as the first public high school for Black students.",38.909,-77.017,"1301 New Jersey Ave NW",Washington,D.C.,DC,https://nps.gov/dunbar
ntf-3,Providence Hospital,"First African American owned and operated hospital in Chicago founded in 1891.",41.803,-87.620,"426 E 51st St",Chicago,Cook,Illinois,https://nps.gov/providence-hospital
`;
          rawSubjects = [...rawSubjects, ...fetchNpsNetworkToFreedom(csvData)];
        }

        if (connectorList.includes('dpla')) {
          reportHarnessProgress({
            stage: 'connector.mock_fixture',
            connectorKind: 'dpla',
            note: 'hardcoded fixture rows, not a live DPLA API pull',
          });
          const mockDpla = [
            {
              id: 'dpla-1',
              isShownAt: 'https://archive.org/item1',
              sourceResource: {
                title: ['Chicago Housing segregation study'],
                description: ['A report detailing HOLC mortgage boundaries and housing credit in Chicago during 1937.'],
              },
            },
            {
              id: 'dpla-2',
              isShownAt: 'https://archive.org/item2',
              sourceResource: {
                title: ['Providence Hospital Auxiliary Board'],
                description: ['Organized in 1892 to support Chicago Providence Hospital operations.'],
              },
            },
          ];
          rawSubjects = [...rawSubjects, ...fetchDplaItems(mockDpla, { query })];
        }

        if (connectorList.includes('web_search')) {
          const searchQuery = `${theme} ${metro} historical sites`;
          try {
            const searxngBaseUrl = process.env.SEARXNG_BASE_URL;
            const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
            let rawResults: readonly WebSearchRawResult[];
            let servedBy: 'searxng' | 'brave' | 'mock';
            if (searxngBaseUrl) {
              // Project's chosen web-search provider (see provider-decision.ts): self-hosted
              // SearXNG on Corsair, preferred over commercial Brave/Exa keys.
              const res = await fetch(buildSearxngSearchUrl({ baseUrl: searxngBaseUrl, query: searchQuery }));
              const json: unknown = await res.json();
              rawResults = parseSearxngSearchResponse(json).results;
              servedBy = 'searxng';
            } else if (braveApiKey) {
              const res = await fetch(buildBraveWebSearchUrl({ query: searchQuery }), {
                headers: { 'X-Subscription-Token': braveApiKey },
              });
              const json: unknown = await res.json();
              rawResults = parseBraveSearchResponse(json).results;
              servedBy = 'brave';
            } else {
              rawResults = [
                {
                  title: 'Mock Discovery Site',
                  description: `Mock finding for ${searchQuery}`,
                  url: 'https://example.com/mock',
                },
              ];
              servedBy = 'mock';
            }
            reportHarnessProgress({ stage: 'web_search.servedBy', servedBy, resultCount: rawResults.length });
            const webSubjects: HarnessRawSubject[] = rawResults.slice(0, 5).map((result, index) => ({
              id: `web-${index}`,
              connectorKind: 'web_search',
              title: result.title ?? 'Unknown Page',
              description: result.description ?? '',
              cites: [result.url],
              rawRecord: { ...result, servedBy },
            }));
            rawSubjects = [...rawSubjects, ...webSubjects];
          } catch (err) {
            stderr(`Warning: Web search failed: ${String(err)}\n`);
          }
        }

        reportHarnessProgress({
          stage: 'connectors.complete',
          rawSubjectsCount: rawSubjects.length,
          connectorKinds: [...new Set(rawSubjects.map((s) => s.connectorKind))],
        });

        // 2. Fetch existing catalog profiles from Postgres for deduplication check
        let existingProfiles: { name: string; entity_id: string }[] = [];
        try {
          const pool = getOpsPostgresPool(process.env);
          const searchResult = await pool.query<{ name: string; entity_id: string }>(
            `SELECT name, entity_id FROM bb_public.search_index LIMIT 2000`
          );
          existingProfiles = searchResult.rows;
        } catch (err) {
          stderr(`Warning: Database connection failed (profiles skipped): ${String(err)}\n`);
        }

        const deduplicatedSubjects = rawSubjects.map((subject) => {
          const cleanName = subject.title.toLowerCase().trim();
          const matched = existingProfiles.find(
            (p) => {
              const pName = p.name ? p.name.toLowerCase().trim() : '';
              return pName === cleanName || pName.startsWith(cleanName) || cleanName.startsWith(pName);
            }
          );
          return {
            ...subject,
            existingEntityId: matched ? matched.entity_id : null,
            isDuplicate: !!matched,
          };
        });

        const overlaps = findSpatialTemporalOverlaps(deduplicatedSubjects, { maxDistanceMeters: 10000 });

        reportHarnessProgress({
          stage: 'dedup.complete',
          rawSubjectsCount: deduplicatedSubjects.length,
          duplicateCount: deduplicatedSubjects.filter((s) => s.isDuplicate).length,
          overlapsCount: overlaps.length,
        });

        type EnrichmentFailure = { readonly id: string; readonly error: string };
        type RelationFailure = {
          readonly subjectAId: string;
          readonly subjectBId: string;
          readonly error: string;
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
            complete: async (prompt: string) => {
              const res = await provider.complete({
                model: model ?? '',
                messages: [{ role: 'user', content: prompt }],
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
              enrichedCandidates.push({ id: subject.id, error: String(err) });
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

        const result = {
          theme,
          metro,
          connectorList,
          rawSubjectsCount: deduplicatedSubjects.length,
          rawSubjects: deduplicatedSubjects,
          overlapsCount: overlaps.length,
          overlaps,
          ...(flags.booleans.has('--enrich')
            ? { enrichedCandidates, adjudicatedRelations }
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
        // Stub: full entity-network expansion depends on repo-xez5.4 (not yet built). This
        // documents the intended interface and returns a stable, honest not-implemented
        // result rather than faking traversal. See docs/research/research-operations.md
        // ("expand") for the interface contract this stub commits to.
        const entityId = requireFlag(flags, '--entity-id');
        const depth = Number(optionalFlag(flags, '--depth') ?? '1');
        stdout(
          JSON.stringify(
            {
              verb: 'expand',
              entityId,
              depth,
              status: 'not_implemented',
              dependsOn: 'repo-xez5.4',
              intendedInterface: {
                command: 'expand --entity-id <id> [--depth N] [--json]',
                output: {
                  entityId: 'string',
                  neighbors: [{ entityId: 'string', relationshipType: 'string', edgeConfidence: 'number' }],
                  frontier: 'entities not yet traversed at the requested depth',
                },
              },
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
        // (bb_submissions.intake_items, status='quarantined'); Firestore-backed
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
             FROM bb_submissions.intake_items
            WHERE status = 'quarantined'
            ORDER BY created_at DESC
            LIMIT $1`,
          [limit],
        );
        stdout(JSON.stringify({ verb: 'graylist-read', source: 'postgres:intake_items', count: rows.length, items: rows }, null, 2));
        return 0;
      }
      case 'quarantine-triage': {
        // Write path for the graylist: judges each quarantined bb_submissions.intake_items
        // row with an LLM (see quarantine-triage.ts for the authority this does and does not
        // have) and, with --commit, moves it to promoted/rejected/spam.
        const limitRaw = optionalFlag(flags, '--limit');
        const limit = limitRaw ? Number(limitRaw) : 50;
        if (!Number.isFinite(limit) || limit < 1) {
          throw new Error('--limit must be a positive number');
        }
        const thresholdRaw = optionalFlag(flags, '--confidence-threshold');
        const confidenceThreshold = thresholdRaw ? Number(thresholdRaw) : 0.6;
        if (!Number.isFinite(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
          throw new Error('--confidence-threshold must be a number between 0 and 1');
        }
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          'mock' | 'openrouter' | 'ollama' | 'hybrid';
        const model = optionalFlag(flags, '--model');
        const provider = createLlmProvider({ provider: providerName, ...(model ? { model } : {}) });
        const pool = getOpsPostgresPool(process.env);
        const { rows } = await pool.query(
          `SELECT id, kind, payload, source_url, created_at
             FROM bb_submissions.intake_items
            WHERE status = 'quarantined'
            ORDER BY created_at ASC
            LIMIT $1`,
          [limit],
        );
        const items: QuarantineIntakeItem[] = rows.map((row: {
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
        }));
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
      default: {
        stderr(
          'Usage: operator-cli <preflight|model-report|submit-lead|research-intake|register-source|attach-evidence|bulk-import|propose-edge|discovery-run|community-obscurity-run|rss-campaign-run|discovery-dispatch|pending-list|editorial-run|enrichment-run|story-research-run|sundown-town-brief|harness-run|locate|backfill-entity|prose-run|expand|graylist-read> [flags]\n' +
          'Every command accepts --json (no-op: output is always JSON) and every id-bearing command uses --entity-id / --case-id for its target.\n' +
          'For model-report: [--since <ISO date>] [--json]\n' +
          'For harness-run: --theme <theme> --metro <metro> [--connectors dpla,nps_network_to_freedom,web_search] [--enrich] [--provider openrouter|ollama|mock] [--progress-path <file>]\n' +
          'For backfill-entity/prose-run: --entity-id <id> [--title ...] [--summary ...] [--provider mock|openrouter|ollama|hybrid] [--commit]\n' +
          'For expand: --entity-id <id> [--depth N] — stub pending repo-xez5.4\n' +
          'For graylist-read: [--limit N] — Postgres quarantine only, see docs/research/research-operations.md\n'
        );
        return command ? 1 : 0;
      }
    }
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

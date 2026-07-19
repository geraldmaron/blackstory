
/**
 * Thin argument-parsing CLI over this package's real, tested functions mirrors the
 * parse-args-then-call-a-tested-function shape of
 * packages/firebase/src/embeddings/backfill-cli.ts elsewhere in this repo. No business logic
 * lives in this file: every command below builds an input object and calls a `prepare*`/`run*`
 * function from `intake.ts`, `bulk-import.ts`, or `discovery-run.ts`.
 *
 * SAFE BY DEFAULT: every command only *prepares* an outcome and prints it as JSON. Passing
 * `--commit` is required to write anything. Intake commands call `commitOperatorIntake`;
 * `locate --commit` calls `commitLocate` (both use real `commitWithAudit`). There is no
 * `--publish`, `--approve`, or `--promote` flag anywhere in this CLI see
 * `promotion-boundary.test.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { RelationshipRole, RelationshipType } from '@repo/domain';
import type { AtomicStore } from '@repo/firebase';
import type { SafeFetchDependencies } from '@repo/security/url-safety';
import {
  parseLeadsFromText,
  prepareBulkLeadIntake,
  type BulkImportFormat,
  type BulkImportSummary,
} from './bulk-import.js';
import { commitOperatorIntake } from './commit.js';
import {
  prepareDiscoverySurvivorIntake,
} from './discovery-survivor-intake.js';
import type { DiscoveryRunBatch } from './discovery-run.js';
import { runBoundedDiscoveryCampaign } from './discovery-run.js';
import {
  runCommunityObscurityOperatorCampaign,
} from './community-obscurity-run.js';
import { runRssOperatorCampaign } from './rss-campaign-run.js';
import { dispatchDiscoveryCampaign } from '../../config/src/scheduled-jobs/discovery-dispatcher.js';
import {
  loadEditorialCatalogFromFirestore,
  mergeJsonCatalogOverFirestore,
} from './editorial-catalog-firestore.js';
import { runEditorialJudge, type EditorialCatalogEntity } from './editorial-run.js';
import { prepareEditorialPacketIntake } from './editorial-intake.js';
import { runEnrichmentJudge } from './enrichment-run.js';
import { createLlmProvider } from './llm-provider.js';
import { loadPendingEditorialItems } from './pending-list.js';
import { runStoryResearch, type StoryTopicSeed } from './story-research-run.js';
import { prepareStoryPacketIntake } from './story-intake.js';
import { prepareEdgeIntake, type EdgeIntakeInput } from './edge-intake.js';
import { createNodeSafeFetchDependencies } from './fetch.js';
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

export type CliDependencies = {
  readonly store?: AtomicStore;
  readonly nowMs?: number;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
  readonly readFile?: (path: string) => string;
  /** Sync file writer used by `--output` (defaults to `writeFileSync`). */
  readonly writeFile?: (path: string, contents: string) => void;
  /** Lazily builds a real Firestore-backed store when `--commit` is set and no `store` is injected. */
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
  '--full',
  '--include-curated',
  '--omit-raw-model',
  '--queue-survivors',
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
  const { createServerFirebaseApp, createAdminAtomicStore } = await import('@repo/firebase');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { app } = createServerFirebaseApp(process.env);
  return createAdminAtomicStore(getFirestore(app));
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
  const [command, ...rest] = argv;

  try {
    const flags = parseFlags(rest);
    switch (command) {
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
        );
        if (!research.fetch.ok) {
          stdout(JSON.stringify({ fetch: research.fetch }, null, 2));
          return 0;
        }
        const intakeSummary = research.intake ? await finish(research.intake, flags, deps) : undefined;
        stdout(
          JSON.stringify(
            {
              fetch: { ok: true, finalUrl: research.fetch.finalUrl, contentHash: research.fetch.contentHash },
              citation: research.citation,
              capturePlan: research.capturePlan,
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
            ? { scope: 'systemic_consensus' as const, ...(consensusBasis ? { consensusBasis } : {}) }
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
        const countries = (optionalFlag(flags, '--countries') ?? 'US').split(',').map((c) => c.trim());
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
          ...(maxCandidatesRaw !== undefined
            ? { maxCandidates: Number(maxCandidatesRaw) }
            : {}),
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
          ...(maxCandidatesRaw !== undefined
            ? { maxCandidates: Number(maxCandidatesRaw) }
            : {}),
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
          ...(maxCandidatesRaw !== undefined
            ? { maxCandidates: Number(maxCandidatesRaw) }
            : {}),
        });

        let queueSummary: Record<string, unknown> | undefined;
        if (queueSurvivors && result.status === 'success' && result.campaign) {
          const intake = prepareDiscoverySurvivorIntake({
            campaign: result.campaign,
            context: buildContext(flags, deps),
            ...(maxSurvivorsRaw !== undefined
              ? { maxSurvivors: Number(maxSurvivorsRaw) }
              : {}),
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
        return result.status === 'success' ? 0 : 1;
      }
      case 'pending-list': {
        const paths = flags.repeated.get('--from') ?? [];
        const single = optionalFlag(flags, '--from');
        const fromPaths = paths.length > 0 ? paths : single ? [single] : [];
        if (fromPaths.length === 0) {
          throw new Error('pending-list requires --from path/to/obscurity-or-subjects.json (repeatable)');
        }
        stdout(JSON.stringify(loadPendingEditorialItems(fromPaths), null, 2));
        return 0;
      }
      case 'editorial-run':
      case 'enrichment-run': {
        const subjectsPath = requireFlag(flags, '--subjects');
        const catalogPath = optionalFlag(flags, '--catalog');
        const catalogFrom = optionalFlag(flags, '--catalog-from');
        const subjectsJson = JSON.parse(readFile(subjectsPath)) as {
          subjects?: EditorialSubjectFile[];
        } | EditorialSubjectFile[];
        const subjects = Array.isArray(subjectsJson)
          ? subjectsJson
          : (subjectsJson.subjects ?? []);
        if (subjects.length === 0) {
          throw new Error('--subjects must be a JSON array or { subjects: [...] }');
        }
        const catalogRaw = catalogPath ? JSON.parse(readFile(catalogPath)) : undefined;
        const jsonCatalogEntries: EditorialCatalogEntity[] = Array.isArray(catalogRaw)
          ? (catalogRaw as EditorialCatalogEntity[])
          : Array.isArray((catalogRaw as { entities?: unknown } | undefined)?.entities)
            ? ((catalogRaw as { entities: EditorialCatalogEntity[] }).entities)
            : [];
        let catalogEntries: EditorialCatalogEntity[] =
          jsonCatalogEntries.length > 0
            ? jsonCatalogEntries
            : subjects.map((subject) => ({
                id: subject.subjectId,
                displayName: subject.title,
              }));
        if (catalogFrom === 'firestore') {
          const { createServerFirebaseApp } = await import('@repo/firebase');
          const { getFirestore } = await import('firebase-admin/firestore');
          const { app } = createServerFirebaseApp(process.env);
          const firestoreCatalog = await loadEditorialCatalogFromFirestore(getFirestore(app));
          catalogEntries =
            jsonCatalogEntries.length > 0
              ? mergeJsonCatalogOverFirestore(firestoreCatalog, jsonCatalogEntries)
              : firestoreCatalog.length > 0
                ? firestoreCatalog
                : catalogEntries;
        } else if (catalogFrom !== undefined) {
          throw new Error('--catalog-from must be "firestore" when set');
        }
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          | 'mock'
          | 'openrouter'
          | 'ollama'
          | 'hybrid';
        if (!['mock', 'openrouter', 'ollama', 'hybrid'].includes(providerName)) {
          throw new Error('--provider must be mock|openrouter|ollama|hybrid');
        }
        const model = optionalFlag(flags, '--model');
        const ollamaModel = optionalFlag(flags, '--ollama-model');
        const concurrencyRaw = optionalFlag(flags, '--concurrency');
        const concurrency = concurrencyRaw !== undefined ? Number(concurrencyRaw) : 1;
        if (!Number.isFinite(concurrency) || concurrency < 1) {
          throw new Error('--concurrency must be a positive number');
        }
        const provider = createLlmProvider({
          provider: providerName,
          ...(model !== undefined ? { model } : {}),
          ...(ollamaModel !== undefined ? { ollamaModel } : {}),
        });
        const nowIso = new Date(deps.nowMs ?? Date.now()).toISOString();
        const identity = readOperatorIdentity(flags);
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
          ...(model !== undefined ? { model } : {}),
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
            commits.push(await finish(prepareEditorialPacketIntake(item.packet, context), flags, deps));
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
        const topicsJson = JSON.parse(readFile(topicsPath)) as {
          topics?: StoryTopicSeed[];
        } | StoryTopicSeed[];
        const topics = Array.isArray(topicsJson) ? topicsJson : (topicsJson.topics ?? []);
        if (topics.length === 0) {
          throw new Error('--topics must be a JSON array or { topics: [...] }');
        }
        const providerName = (optionalFlag(flags, '--provider') ?? 'mock') as
          | 'mock'
          | 'openrouter'
          | 'ollama'
          | 'hybrid';
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
      case 'locate': {
        const storedLat = optionalFlag(flags, '--stored-lat');
        const storedLng = optionalFlag(flags, '--stored-lng');
        const jurisdictionLabel = optionalFlag(flags, '--jurisdiction');
        const locationPrecision = optionalFlag(flags, '--precision');
        const locationId = optionalFlag(flags, '--location-id');
        const role = optionalFlag(flags, '--role') as
          | 'historical'
          | 'current'
          | 'approximate'
          | undefined;
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
          'Usage: operator-cli <submit-lead|research-intake|register-source|attach-evidence|bulk-import|propose-edge|discovery-run|community-obscurity-run|rss-campaign-run|discovery-dispatch|pending-list|editorial-run|enrichment-run|story-research-run|locate> [flags]',
        );
        return command ? 1 : 0;
      }
    }
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

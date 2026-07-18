
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
import { readFileSync } from 'node:fs';
import type { RelationshipRole, RelationshipType } from '@repo/domain';
import type { AtomicStore } from '@repo/firebase';
import type { SafeFetchDependencies } from '@repo/security';
import {
  parseLeadsFromText,
  prepareBulkLeadIntake,
  type BulkImportFormat,
  type BulkImportSummary,
} from './bulk-import.js';
import { commitOperatorIntake } from './commit.js';
import type { DiscoveryRunBatch } from './discovery-run.js';
import { runBoundedDiscoveryCampaign } from './discovery-run.js';
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

const REPEATABLE_FLAGS = new Set(['--source-url']);
const BOOLEAN_FLAGS = new Set(['--commit', '--continue-on-quarantine']);

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
          'Usage: operator-cli <submit-lead|research-intake|register-source|attach-evidence|bulk-import|propose-edge|discovery-run|locate> [flags]',
        );
        return command ? 1 : 0;
      }
    }
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

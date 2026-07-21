/**
 * Supplies deterministic console fixtures for route shells without connecting live services.
 */
import type { ConsoleAction, ConsoleFixtureRow, ConsoleSurface, ConsoleSurfaceId } from './model';

const EMPTY_DIFF = {
  added: 0,
  changed: 0,
  removed: 0,
  unchanged: 0,
  releaseCandidateId: 'release-preview-pending',
} as const;

const DIFF_ONE_CHANGE = {
  added: 0,
  changed: 1,
  removed: 0,
  unchanged: 28,
  releaseCandidateId: 'rel-candidate-2026-07-17-01',
} as const;

function action(
  value: Omit<ConsoleAction, 'endpoint' | 'destination' | 'publicationDiff'> &
    Partial<Pick<ConsoleAction, 'destination' | 'publicationDiff'>>,
): ConsoleAction {
  return {
    id: value.id,
    label: value.label,
    permission: value.permission,
    endpoint: `/api/admin/${value.id}`,
    destination: value.destination ?? 'canonical-draft',
    publicationDiff: value.publicationDiff ?? DIFF_ONE_CHANGE,
    ...(value.privilegedAction ? { privilegedAction: value.privilegedAction } : {}),
    ...(value.bulk ? { bulk: value.bulk } : {}),
  };
}

function rows(...values: readonly ConsoleFixtureRow[]): readonly ConsoleFixtureRow[] {
  return values;
}

const surfaces: readonly ConsoleSurface[] = [
  {
    id: 'candidate-queue',
    label: 'Candidate queue',
    eyebrow: 'Intake',
    description: 'Triage newly discovered people and records before research begins.',
    rows: rows(
      {
        id: 'CAN-1042',
        title: 'Ada L. Thompson',
        status: 'Awaiting triage',
        detail: 'Library of Congress authority record · discovered 18 minutes ago',
      },
      {
        id: 'CAN-1038',
        title: 'Greenwood Mutual Aid register',
        status: 'Needs owner',
        detail: 'NARA adapter · two possible person entities',
      },
    ),
    actions: [
      action({
        id: 'candidate-assign',
        label: 'Assign selected candidates',
        permission: 'research:write',
        bulk: { maximumItems: 50, rollbackSupported: true },
      }),
    ],
  },
  {
    id: 'relevance-review',
    label: 'Relevance review',
    eyebrow: 'Research',
    description: 'Record scope decisions with cited evidence and an append-only reason.',
    rows: rows(
      {
        id: 'REV-882',
        title: 'M. Carter school board minutes',
        status: 'Evidence requested',
        detail: 'Two scope indicators · one unresolved identity',
      },
      {
        id: 'REV-879',
        title: 'East Ward organizing committee',
        status: 'Ready for decision',
        detail: 'Three independent sources',
      },
    ),
    actions: [
      action({
        id: 'relevance-decide',
        label: 'Record relevance decision',
        permission: 'research:write',
      }),
    ],
  },
  {
    id: 'entity-resolution',
    label: 'Entity resolution',
    eyebrow: 'Identity',
    description: 'Compare candidate identities and preserve merge or split provenance.',
    rows: rows(
      {
        id: 'ER-221',
        title: 'Evelyn Brooks / E. M. Brooks',
        status: 'Possible match · 0.78',
        detail: 'Shared institution and city; birth year conflicts',
      },
      {
        id: 'ER-219',
        title: 'J. Franklin / James Franklin',
        status: 'Manual review',
        detail: 'Name-only match is below automation threshold',
      },
    ),
    actions: [
      action({
        id: 'entity-merge',
        label: 'Stage entity merge',
        permission: 'research:write',
        privilegedAction: 'rights_change',
      }),
    ],
  },
  {
    id: 'sources',
    label: 'Source registry',
    eyebrow: 'Ingestion',
    description: 'Inspect registry coverage, adapter health, provenance, and containment state.',
    rows: rows(
      {
        id: 'SRC-LOC',
        title: 'Library of Congress',
        status: 'Healthy',
        detail: 'Last fixture validation 7 minutes ago · schema v1',
      },
      {
        id: 'SRC-NARA',
        title: 'National Archives',
        status: 'Degraded',
        detail: 'Backoff active · no records discarded',
      },
    ),
    actions: [
      action({
        id: 'source-pause',
        label: 'Stage adapter pause',
        permission: 'policy:change',
        privilegedAction: 'policy_change',
      }),
    ],
  },
  {
    id: 'research-cases',
    label: 'Research cases',
    eyebrow: 'Workflow',
    description: 'Track assignments, evidence checklists, enrichment, and backfill work.',
    rows: rows(
      {
        id: 'CASE-340',
        title: 'Lillian Parker',
        status: 'Minimum record',
        detail: '5/5 publication requirements · optional geography missing',
      },
      {
        id: 'CASE-337',
        title: 'Southside Nurses Association',
        status: 'Partial enrichment',
        detail: 'Assigned to Research Team A',
      },
    ),
    actions: [
      action({
        id: 'case-transition',
        label: 'Record case transition',
        permission: 'research:write',
      }),
    ],
  },
  {
    id: 'evidence',
    label: 'Claims & evidence',
    eyebrow: 'Analysis',
    description: 'Review claims, evidence links, contradictions, and confidence together.',
    rows: rows(
      {
        id: 'CLM-7781',
        title: 'Served as chapter secretary',
        status: 'Confidence 0.84 · corroborated',
        detail: 'Two sources · no open contradiction',
      },
      {
        id: 'CLM-7774',
        title: 'Moved to Chicago in 1938',
        status: 'Confidence 0.42 · disputed',
        detail: 'One source conflicts with the 1940 census',
      },
    ),
    actions: [
      action({
        id: 'claim-revise',
        label: 'Stage claim revision',
        permission: 'research:write',
      }),
    ],
  },
  {
    id: 'submissions',
    label: 'Submission moderation',
    eyebrow: 'Community',
    description: 'Moderate public corrections without granting canonical write access.',
    rows: rows(
      {
        id: 'SUB-603',
        title: 'Correction to organization dates',
        status: 'Awaiting moderation',
        detail: 'Two attachments quarantined · submitter identity withheld',
      },
      {
        id: 'SUB-598',
        title: 'Additional newspaper citation',
        status: 'Safe to review',
        detail: 'Malware scan passed · rights declaration present',
      },
    ),
    actions: [
      action({
        id: 'submission-promote',
        label: 'Promote to research case',
        permission: 'research:write',
      }),
    ],
  },
  {
    id: 'publication',
    label: 'Publication',
    eyebrow: 'Release',
    description: 'Preview signed release candidates and activate only after diff review.',
    rows: rows(
      {
        id: 'REL-2026-0717',
        title: 'July candidate 04',
        status: 'Awaiting approval',
        detail: '+12 added · 4 changed · 0 removed',
      },
      {
        id: 'REL-2026-0710',
        title: 'July release 03',
        status: 'Active',
        detail: 'Immutable manifest · 2,841 projections',
      },
    ),
    actions: [
      action({
        id: 'release-activate',
        label: 'Activate release candidate',
        permission: 'publication:publish',
        destination: 'release-candidate',
        publicationDiff: {
          added: 12,
          changed: 4,
          removed: 0,
          unchanged: 2825,
          releaseCandidateId: 'REL-2026-0717',
        },
        privilegedAction: 'publication',
      }),
    ],
  },
  {
    id: 'retractions',
    label: 'Retraction & rollback',
    eyebrow: 'Release safety',
    description:
      'Replace releases through immutable history; never edit or delete an active projection.',
    rows: rows(
      {
        id: 'RTR-92',
        title: 'Remove CLM-7112 from public corpus',
        status: 'Replacement preview',
        detail: 'Creates REL-2026-0717-R1 · prior release remains immutable',
      },
      {
        id: 'RTR-89',
        title: 'Rollback July release 02',
        status: 'Completed',
        detail: 'Pointer moved to verified replacement release',
      },
    ),
    actions: [
      action({
        id: 'release-retract',
        label: 'Create replacement release',
        permission: 'publication:retract',
        destination: 'release-candidate',
        publicationDiff: {
          added: 0,
          changed: 0,
          removed: 1,
          unchanged: 2840,
          releaseCandidateId: 'REL-2026-0717-R1',
        },
        privilegedAction: 'retraction',
      }),
    ],
  },
  {
    id: 'audit',
    label: 'Audit explorer',
    eyebrow: 'Accountability',
    description: 'Trace actor, authorization, reason, diff, and release lineage.',
    rows: rows(
      {
        id: 'AUD-99182',
        title: 'Case transition recorded',
        status: 'Verified',
        detail: 'researcher@example.org · CASE-340 · reason retained',
      },
      {
        id: 'AUD-99178',
        title: 'Release candidate previewed',
        status: 'Verified',
        detail: 'publisher@example.org · REL-2026-0717',
      },
    ),
    actions: [
      action({
        id: 'audit-export',
        label: 'Prepare privileged export',
        permission: 'export:privileged',
        publicationDiff: EMPTY_DIFF,
        privilegedAction: 'privileged_export',
      }),
    ],
  },
  {
    id: 'security-ops',
    label: 'Security & operations',
    eyebrow: 'Operational health',
    description: 'Inspect service posture, queue safety, auth signals, and recovery readiness.',
    rows: rows(
      {
        id: 'OPS-IAP',
        title: 'Layered administrator auth',
        status: 'Configured in repository',
        detail: 'Verified Supabase token + app-metadata role',
      },
      {
        id: 'OPS-QUEUE',
        title: 'Research queue',
        status: 'Within SLO',
        detail: 'Oldest item 14 minutes · no purge requested',
      },
    ),
    actions: [
      action({
        id: 'ops-contain',
        label: 'Stage containment plan',
        permission: 'policy:change',
        publicationDiff: EMPTY_DIFF,
        privilegedAction: 'policy_change',
      }),
    ],
  },
  {
    id: 'switches',
    label: 'Feature & kill switches',
    eyebrow: 'Containment',
    description: 'Review fail-safe switch definitions and stage independently scoped changes.',
    rows: rows(
      {
        id: 'publication',
        title: 'Publication',
        status: 'Essential · fail closed',
        detail: 'Stops projection generation, release activation, and release promotion.',
      },
      {
        id: 'queue-processing',
        title: 'Queue processing',
        status: 'Essential · tasks retained',
        detail: 'Pauses queue dispatch without deleting or purging queued tasks.',
      },
      {
        id: 'llm-calls',
        title: 'Model calls',
        status: 'Optional · fail closed',
        detail: 'Stops every model invocation independently.',
      },
      {
        id: 'public-static-mode',
        title: 'Public static mode',
        status: 'Public serving · immutable reads remain',
        detail: 'Forces read-only serving from immutable public release snapshots.',
      },
    ),
    actions: [
      action({
        id: 'switch-stage',
        label: 'Stage switch change',
        permission: 'policy:change',
        publicationDiff: EMPTY_DIFF,
        privilegedAction: 'policy_change',
        bulk: { maximumItems: 20, rollbackSupported: true },
      }),
    ],
  },
];

export const CONSOLE_SURFACES: readonly ConsoleSurface[] = surfaces;

export function getConsoleSurface(id: string): ConsoleSurface | undefined {
  return surfaces.find((surface) => surface.id === id);
}

export function isConsoleSurfaceId(value: string): value is ConsoleSurfaceId {
  return surfaces.some((surface) => surface.id === value);
}

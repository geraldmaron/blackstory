/**
 * Internet Archive + community DPLA v2 discovery campaign.
 *
 * Fixture-first dual-lane orchestration: IA advanced-search JSON and DPLA v2 search JSON
 * normalize into private candidates, merge under shared + per-adapter sub-budgets, and
 * never publish. Federal fixture adapter `dpla-items-v1` is explicitly excluded.
 */
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import {
  createInternetArchiveAdapterContract,
  INTERNET_ARCHIVE_ADAPTER_ID,
  normalizeInternetArchiveBatch,
  parseAdvancedSearchResponse,
} from '../adapters/internet-archive/index.js';
import {
  createDplaV2AdapterContract,
  DPLA_V2_ADAPTER_ID,
  normalizeDplaBatch,
  parseDplaSearchResponse,
} from '../adapters/dpla/index.js';
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type { EvidenceSource } from '../provenance/source.js';
import { buildQueryPack, type QueryPack } from '../query-packs/index.js';
import type { AuditActor } from '../audit/index.js';
import { createDiscoveryCampaignConfig } from './campaign.js';
import {
  assertCampaignCannotPublish,
  listCampaignSurvivors,
  runOptionalEditorialHook,
  summarizeCampaignYield,
  toEditorialLeadPreview,
  type CampaignEditorialHook,
  type CampaignYieldSummary,
  type EditorialReviewResult,
} from './campaign-runner.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type { DiscoveryCampaignResult } from './types.js';

export const ARCHIVE_DPLA_CAMPAIGN_KIND = 'archive-dpla-discovery.v1' as const;

/** Allowed community adapter ids — never includes federal `dpla-items-v1`. */
export const ARCHIVE_DPLA_ADAPTER_IDS = [
  INTERNET_ARCHIVE_ADAPTER_ID,
  DPLA_V2_ADAPTER_ID,
] as const;

/**
 * Sub-budget policy between Internet Archive and DPLA v2 lanes.
 *
 * - Shared ceiling 500 matches roster `discovery-campaign-archive-dpla` budget.maxPerRun.
 * - IA lane 300 (60%): breadth-first digitized community materials from archive.org.
 * - DPLA lane 200 (40%): aggregator depth via live api.dp.la/v2 (`dpla` adapter).
 * - Federal fixture family `dpla-items-v1` is out of scope for this campaign.
 */
export const ARCHIVE_DPLA_SUB_BUDGET_POLICY = {
  maxCandidates: 500,
  maxInternetArchive: 300,
  maxDpla: 200,
} as const;

export type ArchiveDplaSubBudgetSnapshot = {
  readonly policy: typeof ARCHIVE_DPLA_SUB_BUDGET_POLICY;
  readonly internetArchiveIngested: number;
  readonly dplaIngested: number;
  readonly combinedIngested: number;
};

export type ArchiveDplaCampaignResult = {
  readonly kind: typeof ARCHIVE_DPLA_CAMPAIGN_KIND;
  readonly adapterIds: typeof ARCHIVE_DPLA_ADAPTER_IDS;
  readonly subBudget: ArchiveDplaSubBudgetSnapshot;
  readonly campaign: DiscoveryCampaignResult;
  readonly yield: CampaignYieldSummary;
  readonly editorialReviews: readonly EditorialReviewResult[];
  readonly completedAt: string;
};

export type RunArchiveDplaCampaignInput = {
  /** Internet Archive advanced-search JSON (fixture or live response shape). */
  readonly internetArchiveSearchJson?: unknown;
  /** DPLA v2 search JSON (fixture or live response shape). */
  readonly dplaSearchJson?: unknown;
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly pack?: QueryPack;
  readonly maxCandidates?: number;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly editorialHook?: CampaignEditorialHook;
  readonly operatorActor?: AuditActor;
};

function defaultArchiveDplaPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-archive-dpla',
    displayName: 'Archive + DPLA v2 discovery',
    entityKind: 'place',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'Piedmont', termClass: 'geographic' },
      { text: 'Rosewood', termClass: 'geographic' },
      { text: 'school', termClass: 'modern' },
      { text: 'church', termClass: 'modern' },
      { text: 'directory', termClass: 'historical' },
    ],
  });
}

function ensureApprovedInternetArchiveRegistry(
  store: SourceRegistryStore,
  now: string,
): SourceRegistryEntry {
  const existing = store.get('reg_internet_archive_archive_dpla');
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract = createInternetArchiveAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_internet_archive_archive_dpla',
    organizationId: 'org_community',
    displayName: 'Internet Archive Discovery (archive-dpla campaign)',
    classification: contract.classification,
    adapterId: INTERNET_ARCHIVE_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:internet_archive',
    createdAt: now,
    updatedAt: now,
  };
  if (!existing) {
    registerSource(store, {
      id: 'reg_internet_archive_archive_dpla',
      contract,
      evidenceSource,
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: 'reg_internet_archive_archive_dpla',
    approvedBy: 'archive-dpla-campaign',
    approvedAt: now,
  });
}

function ensureApprovedDplaRegistry(store: SourceRegistryStore, now: string): SourceRegistryEntry {
  const existing = store.get('reg_dpla_v2_archive_dpla');
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract = createDplaV2AdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_dpla_v2_archive_dpla',
    organizationId: 'org_community',
    displayName: 'DPLA v2 Discovery (archive-dpla campaign)',
    classification: contract.classification,
    adapterId: DPLA_V2_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:dpla',
    createdAt: now,
    updatedAt: now,
  };
  if (!existing) {
    registerSource(store, {
      id: 'reg_dpla_v2_archive_dpla',
      contract,
      evidenceSource,
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: 'reg_dpla_v2_archive_dpla',
    approvedBy: 'archive-dpla-campaign',
    approvedAt: now,
  });
}

export function applyArchiveDplaSubBudgets(input: {
  readonly internetArchiveRecords: readonly AdapterCandidateRecord[];
  readonly dplaRecords: readonly AdapterCandidateRecord[];
  readonly policy?: typeof ARCHIVE_DPLA_SUB_BUDGET_POLICY;
  readonly maxCandidates?: number;
}): { readonly records: readonly AdapterCandidateRecord[]; readonly subBudget: ArchiveDplaSubBudgetSnapshot } {
  const policy = input.policy ?? ARCHIVE_DPLA_SUB_BUDGET_POLICY;
  const sharedCap = input.maxCandidates ?? policy.maxCandidates;
  const iaSlice = input.internetArchiveRecords.slice(0, policy.maxInternetArchive);
  const dplaSlice = input.dplaRecords.slice(0, policy.maxDpla);
  const combined = [...iaSlice, ...dplaSlice].slice(0, sharedCap);
  return {
    records: combined,
    subBudget: {
      policy,
      internetArchiveIngested: iaSlice.length,
      dplaIngested: dplaSlice.length,
      combinedIngested: combined.length,
    },
  };
}

/**
 * Run Internet Archive + DPLA v2 fixtures through discovery. Private candidates only.
 */
export async function runArchiveDplaCampaign(
  input: RunArchiveDplaCampaignInput,
): Promise<ArchiveDplaCampaignResult> {
  assertCampaignCannotPublish();

  const runId = input.runId ?? `run_archive_dpla_${input.stampedAt}`;
  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();
  const iaRegistry = ensureApprovedInternetArchiveRegistry(sourceRegistry, input.stampedAt);
  const dplaRegistry = ensureApprovedDplaRegistry(sourceRegistry, input.stampedAt);

  const iaRecords: AdapterCandidateRecord[] = [];
  if (input.internetArchiveSearchJson !== undefined) {
    const batch = parseAdvancedSearchResponse(input.internetArchiveSearchJson);
    iaRecords.push(
      ...normalizeInternetArchiveBatch({
        docs: batch.docs,
        registryEntry: iaRegistry,
        runId,
        capturedAt: input.stampedAt,
      }),
    );
  }

  const dplaRecords: AdapterCandidateRecord[] = [];
  if (input.dplaSearchJson !== undefined) {
    const batch = parseDplaSearchResponse(input.dplaSearchJson);
    dplaRecords.push(
      ...normalizeDplaBatch({
        docs: batch.docs,
        registryEntry: dplaRegistry,
        runId,
        capturedAt: input.stampedAt,
      }),
    );
  }

  if (iaRecords.length === 0 && dplaRecords.length === 0) {
    throw new Error('Archive DPLA campaign received no Internet Archive or DPLA v2 fixture JSON');
  }

  const maxCandidates = input.maxCandidates ?? ARCHIVE_DPLA_SUB_BUDGET_POLICY.maxCandidates;
  const { records, subBudget } = applyArchiveDplaSubBudgets({
    internetArchiveRecords: iaRecords,
    dplaRecords,
    maxCandidates,
  });

  const pack = input.pack ?? defaultArchiveDplaPack(input.stampedAt);
  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_archive_dpla_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: {
        countries: ['US'],
        adapterIds: [...ARCHIVE_DPLA_ADAPTER_IDS],
      },
      continueOnQuarantine: true,
    }),
    records,
    pack,
    runContext: {
      runId,
      adapterId: INTERNET_ARCHIVE_ADAPTER_ID,
      startedAt: input.stampedAt,
      entityKind: 'place',
      theme: 'civil_rights',
    },
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
  };

  const campaign = runDiscoveryCampaign(campaignInput);
  const survivors = listCampaignSurvivors(campaign);
  const yieldSummary = summarizeCampaignYield({ campaign });

  const editorialReviews = await runOptionalEditorialHook(
    input.editorialHook,
    survivors.map(toEditorialLeadPreview),
  );

  return {
    kind: ARCHIVE_DPLA_CAMPAIGN_KIND,
    adapterIds: ARCHIVE_DPLA_ADAPTER_IDS,
    subBudget,
    campaign,
    yield: yieldSummary,
    editorialReviews,
    completedAt: input.completedAt,
  };
}

/**
 * HBCU Special Collections discovery campaign.
 *
 * Dual-lane, fixture-first orchestration mirroring `archive-dpla-campaign.ts`:
 * - DPLA hub lane: existing community DPLA v2 adapter output filtered/prioritized to seeded
 *   HBCU contributors (Howard, Fisk, Tuskegee, Hampton, HBCU Library Alliance, …).
 * - EAD finding-aid lane: an injected `HbcuAdapter` (fixture in tests; safe-fetch-backed in
 *   production) lists finding aids per seeded institution and extracts candidate components.
 *
 * Candidates gather, classify, dedupe, and score obscurity — private research candidates
 * only, never a publish path (ADR-009). Federal fixture adapter `dpla-items-v1` is excluded.
 * Self-contained: does NOT import from `county-archive-campaign.ts` or `finding-aid`.
 */
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import {
  createDplaV2AdapterContract,
  DPLA_V2_ADAPTER_ID,
  normalizeDplaBatch,
  parseDplaSearchResponse,
} from '../adapters/dpla/index.js';
import type { DplaNormalizedDoc } from '../adapters/dpla/types.js';
import {
  HBCU_COLLECTIONS_ADAPTER_ID,
  normalizeHbcuBatch,
  registerHbcuCollectionSource,
  type HbcuAdapter,
  type HbcuCollectionSource,
} from '../adapters/hbcu-collections/index.js';
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type { EvidenceSource } from '../provenance/source.js';
import { buildQueryPack, type QueryPack } from '../query-packs/index.js';
import type { ResolutionProfile } from '../resolution/types.js';
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
import {
  OBSCURITY_METHODOLOGY_DISCLAIMER,
  rankByObscurity,
  scoreObscurity,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
} from './obscurity.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type { DiscoveryCampaignResult, DiscoveryCandidateRecord } from './types.js';

export const HBCU_CAMPAIGN_KIND = 'hbcu-collections-discovery.v1' as const;

/** Allowed adapter ids — community DPLA v2 + HBCU collections; never federal `dpla-items-v1`. */
export const HBCU_CAMPAIGN_ADAPTER_IDS = [DPLA_V2_ADAPTER_ID, HBCU_COLLECTIONS_ADAPTER_ID] as const;

/**
 * Sub-budget policy between the DPLA hub lane and the EAD finding-aid lane.
 *
 * - Shared ceiling 300: HBCU archives are metadata-rich but finding-aid components are far
 *   fewer per run than aggregator search hits; a modest ceiling keeps runs reviewable.
 * - DPLA hub lane 180 (60%): breadth via contributor-filtered aggregator records.
 * - EAD lane 120 (40%): depth from institution finding aids that never reach DPLA.
 */
export const HBCU_SUB_BUDGET_POLICY = {
  maxCandidates: 300,
  maxDplaHub: 180,
  maxFindingAid: 120,
} as const;

export type HbcuSubBudgetSnapshot = {
  readonly policy: typeof HBCU_SUB_BUDGET_POLICY;
  readonly dplaHubIngested: number;
  /** DPLA docs dropped because no seeded HBCU contributor matched. */
  readonly dplaNonHbcuSkipped: number;
  readonly findingAidIngested: number;
  readonly combinedIngested: number;
};

export type HbcuRankedLead = {
  readonly candidateId: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly classification?: string;
  readonly obscurity: ObscurityAssessment;
};

export type HbcuCampaignResult = {
  readonly kind: typeof HBCU_CAMPAIGN_KIND;
  readonly adapterIds: typeof HBCU_CAMPAIGN_ADAPTER_IDS;
  readonly seededSourceIds: readonly string[];
  readonly subBudget: HbcuSubBudgetSnapshot;
  readonly campaign: DiscoveryCampaignResult;
  readonly ranked: readonly HbcuRankedLead[];
  readonly yield: CampaignYieldSummary;
  readonly editorialReviews: readonly EditorialReviewResult[];
  readonly disclaimer: typeof OBSCURITY_METHODOLOGY_DISCLAIMER;
  readonly completedAt: string;
};

export type RunHbcuCampaignInput = {
  /** Seeded HBCU collections (parse `fixtures/hbcu-collections.v1.json` or inject inline). */
  readonly sources: readonly HbcuCollectionSource[];
  /** DPLA v2 search JSON (fixture or live response shape) for the DPLA hub lane. */
  readonly dplaSearchJson?: unknown;
  /** Injected finding-aid harvester for the EAD lane (fixture in tests; safe-fetch live). */
  readonly hbcuAdapter?: HbcuAdapter;
  /** Catalog display names/titles for the obscurity reference corpus. */
  readonly catalogTitles?: readonly string[];
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly pack?: QueryPack;
  readonly maxCandidates?: number;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly editorialHook?: CampaignEditorialHook;
  /** Optional catalog profiles for soft propose/review match (never hard-exclude). */
  readonly catalogProfiles?: readonly ResolutionProfile[];
};

function defaultHbcuPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-hbcu-collections',
    displayName: 'HBCU special collections discovery',
    entityKind: 'institution',
    theme: 'institutional_records',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'Moorland-Spingarn', termClass: 'source_specific', sourceId: 'howard-msrc' },
      { text: 'normal school', termClass: 'historical' },
      { text: 'freedmen', termClass: 'historical' },
      { text: 'college', termClass: 'modern' },
      { text: 'Nashville', termClass: 'geographic' },
      { text: 'Tuskegee', termClass: 'geographic' },
    ],
  });
}

/**
 * True when a DPLA doc's provider/contributor matches a seeded HBCU collection's
 * `dplaContributorMatch` fragment (case-insensitive substring — provider display names vary
 * across hubs and the July 2026 aggregation transition).
 */
export function matchHbcuContributor(
  providerName: string | undefined,
  sources: readonly HbcuCollectionSource[],
): HbcuCollectionSource | undefined {
  if (!providerName) return undefined;
  const haystack = providerName.toLowerCase();
  return sources.find((source) => {
    const needle = source.dplaContributorMatch?.toLowerCase();
    return Boolean(needle && haystack.includes(needle));
  });
}

/** Partition DPLA docs into HBCU-contributor matches and skipped non-HBCU docs. */
export function filterDplaDocsToHbcuHubs(
  docs: readonly DplaNormalizedDoc[],
  sources: readonly HbcuCollectionSource[],
): { readonly matched: readonly DplaNormalizedDoc[]; readonly skippedCount: number } {
  const matched = docs.filter((doc) => matchHbcuContributor(doc.providerName, sources));
  return { matched, skippedCount: docs.length - matched.length };
}

export function applyHbcuSubBudgets(input: {
  readonly dplaHubRecords: readonly AdapterCandidateRecord[];
  readonly findingAidRecords: readonly AdapterCandidateRecord[];
  readonly dplaNonHbcuSkipped: number;
  readonly policy?: typeof HBCU_SUB_BUDGET_POLICY;
  readonly maxCandidates?: number;
}): {
  readonly records: readonly AdapterCandidateRecord[];
  readonly subBudget: HbcuSubBudgetSnapshot;
} {
  const policy = input.policy ?? HBCU_SUB_BUDGET_POLICY;
  const sharedCap = input.maxCandidates ?? policy.maxCandidates;
  const dplaSlice = input.dplaHubRecords.slice(0, policy.maxDplaHub);
  const eadSlice = input.findingAidRecords.slice(0, policy.maxFindingAid);
  // EAD finding-aid records lead: they are the leads federal aggregators never surface.
  const combined = [...eadSlice, ...dplaSlice].slice(0, sharedCap);
  return {
    records: combined,
    subBudget: {
      policy,
      dplaHubIngested: dplaSlice.length,
      dplaNonHbcuSkipped: input.dplaNonHbcuSkipped,
      findingAidIngested: eadSlice.length,
      combinedIngested: combined.length,
    },
  };
}

function ensureApprovedDplaRegistry(store: SourceRegistryStore, now: string): SourceRegistryEntry {
  const existing = store.get('reg_dpla_v2_hbcu');
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract = createDplaV2AdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_dpla_v2_hbcu',
    organizationId: 'org_community',
    displayName: 'DPLA v2 Discovery (HBCU hub lane)',
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
      id: 'reg_dpla_v2_hbcu',
      contract,
      evidenceSource,
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: 'reg_dpla_v2_hbcu',
    approvedBy: 'hbcu-campaign',
    approvedAt: now,
  });
}

/**
 * Ensure a seeded HBCU collection source is registered (disabled by default per methodology)
 * and campaign-approved for this run. Mirrors the archive-dpla ensure-approve pattern.
 */
function ensureApprovedHbcuRegistry(
  store: SourceRegistryStore,
  source: HbcuCollectionSource,
  now: string,
): SourceRegistryEntry {
  const existing = store.get(source.registryEntryId);
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  if (!existing) {
    registerHbcuCollectionSource({ store, source, createdAt: now });
  }
  return approveSourcePolicy(store, {
    id: source.registryEntryId,
    approvedBy: 'hbcu-campaign',
    approvedAt: now,
  });
}

/**
 * Run seeded HBCU special collections through discovery: DPLA hub lane (contributor-filtered)
 * plus standalone EAD finding-aid lane, then dedupe, budget, and rank survivors by obscurity.
 * Private candidates only — no publish path.
 */
export async function runHbcuCampaign(input: RunHbcuCampaignInput): Promise<HbcuCampaignResult> {
  assertCampaignCannotPublish();

  if (input.sources.length === 0) {
    throw new Error('HBCU campaign requires at least one seeded HBCU collection source');
  }

  const runId = input.runId ?? `run_hbcu_${input.stampedAt}`;
  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();

  // Lane 1: DPLA hub — reuse the community DPLA v2 adapter, prioritized to HBCU contributors.
  const dplaRecords: AdapterCandidateRecord[] = [];
  let dplaNonHbcuSkipped = 0;
  if (input.dplaSearchJson !== undefined) {
    const dplaRegistry = ensureApprovedDplaRegistry(sourceRegistry, input.stampedAt);
    const batch = parseDplaSearchResponse(input.dplaSearchJson);
    const { matched, skippedCount } = filterDplaDocsToHbcuHubs(batch.docs, input.sources);
    dplaNonHbcuSkipped = skippedCount;
    dplaRecords.push(
      ...normalizeDplaBatch({
        docs: matched,
        registryEntry: dplaRegistry,
        runId,
        capturedAt: input.stampedAt,
      }),
    );
  }

  // Lane 2: standalone EAD finding aids via the injected (fixture or safe-fetch) adapter.
  const eadRecords: AdapterCandidateRecord[] = [];
  const seededSourceIds: string[] = [];
  if (input.hbcuAdapter !== undefined) {
    for (const source of input.sources) {
      if (source.lane !== 'ead-finding-aid') continue;
      const registryEntry = ensureApprovedHbcuRegistry(sourceRegistry, source, input.stampedAt);
      seededSourceIds.push(source.id);
      const findingAids = await input.hbcuAdapter.listFindingAids(source.institution);
      for (const findingAid of findingAids) {
        const candidates = await input.hbcuAdapter.extractCandidates(findingAid);
        eadRecords.push(
          ...normalizeHbcuBatch({
            candidates,
            registryEntry,
            runId,
            capturedAt: input.stampedAt,
          }),
        );
      }
    }
  }

  if (dplaRecords.length === 0 && eadRecords.length === 0) {
    throw new Error(
      'HBCU campaign gathered no candidates: provide dplaSearchJson (with seeded HBCU ' +
        'contributors) and/or an hbcuAdapter with ead-finding-aid lane sources',
    );
  }

  const maxCandidates = input.maxCandidates ?? HBCU_SUB_BUDGET_POLICY.maxCandidates;
  const { records, subBudget } = applyHbcuSubBudgets({
    dplaHubRecords: dplaRecords,
    findingAidRecords: eadRecords,
    dplaNonHbcuSkipped,
    maxCandidates,
  });

  const pack = input.pack ?? defaultHbcuPack(input.stampedAt);
  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_hbcu_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: {
        countries: ['US'],
        adapterIds: [...HBCU_CAMPAIGN_ADAPTER_IDS],
      },
      continueOnQuarantine: true,
    }),
    records,
    pack,
    runContext: {
      runId,
      adapterId: HBCU_COLLECTIONS_ADAPTER_ID,
      startedAt: input.stampedAt,
      entityKind: 'institution',
      theme: 'institutional_records',
    },
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
    ...(input.catalogProfiles !== undefined
      ? { catalog: { profiles: input.catalogProfiles } }
      : {}),
  };

  const campaign = runDiscoveryCampaign(campaignInput);
  const survivors = listCampaignSurvivors(campaign);
  const yieldSummary = summarizeCampaignYield({ campaign });

  // Obscurity: HBCU holdings skew toward exactly the under-documented people/institutions
  // this platform exists to surface — rank so operators review the most obscure first.
  const corpus: ObscurityReferenceCorpus = { catalogTitles: input.catalogTitles ?? [] };
  const assessments = survivors.map((candidate: DiscoveryCandidateRecord) =>
    scoreObscurity({ candidate, corpus, assessedAt: input.completedAt }),
  );
  const rankedAssessments = rankByObscurity(assessments);
  const ranked: HbcuRankedLead[] = rankedAssessments.map((obscurity) => {
    const candidate = survivors.find((entry) => entry.id === obscurity.candidateId)!;
    return {
      candidateId: candidate.id,
      ...(candidate.adapterRecord.title !== undefined
        ? { title: candidate.adapterRecord.title }
        : {}),
      ...(candidate.adapterRecord.canonicalUrl !== undefined
        ? { canonicalUrl: candidate.adapterRecord.canonicalUrl }
        : {}),
      ...(candidate.adapterRecord.classification !== undefined
        ? { classification: candidate.adapterRecord.classification }
        : {}),
      obscurity,
    };
  });

  const editorialReviews = await runOptionalEditorialHook(
    input.editorialHook,
    survivors.map(toEditorialLeadPreview),
  );

  return {
    kind: HBCU_CAMPAIGN_KIND,
    adapterIds: HBCU_CAMPAIGN_ADAPTER_IDS,
    seededSourceIds,
    subBudget,
    campaign,
    ranked,
    yield: yieldSummary,
    editorialReviews,
    disclaimer: OBSCURITY_METHODOLOGY_DISCLAIMER,
    completedAt: input.completedAt,
  };
}

/**
 * Web-search discovery campaign (fixture-first, fail-closed).
 *
 * Preferred provider: SearXNG (self-hosted OSS). Brave remains supported.
 * Flow: parse provider response → `normalizeWebSearchBatch` → `runDiscoveryCampaign`.
 *
 * Fail-closed gates (in order):
 * 1. Campaign refuses to run unless `providerConfig.storageTermsConfirmed === true`
 * 2. `normalizeWebSearchBatch` re-checks via `assertStorageTermsConfirmed`
 * 3. `assertCampaignCannotPublish` — discovery never publishes
 */
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import {
  assertStorageTermsConfirmed,
  BRAVE_SEARCH_ADAPTER_ID,
  SEARXNG_SEARCH_ADAPTER_ID,
  buildWebSearchQueryTexts,
  createBraveSearchAdapterContract,
  createSearxngSearchAdapterContract,
  parseBraveSearchResponse,
  parseSearxngSearchResponse,
  normalizeWebSearchBatch,
  stampExternalQueryProvenance,
  webSearchAdapterId,
  WEB_SEARCH_PROVIDER_DECISION,
  type WebSearchGeographicSeed,
  type WebSearchParsedBatch,
  type WebSearchProvider,
  type WebSearchProviderConfig,
} from '../adapters/web-search/index.js';
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
  type EditorialReviewResult,
  type CampaignYieldSummary,
} from './campaign-runner.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type { DiscoveryCampaignResult } from './types.js';

export const WEB_SEARCH_CAMPAIGN_KIND = 'web-search-discovery.v1' as const;

/** Matches scheduled-jobs roster `discovery-campaign-web-search` budget.maxPerRun. */
export const WEB_SEARCH_MAX_REQUESTS_PER_RUN = 50 as const;

export type WebSearchWaybackGate = 'deferred' | 'required_unmet' | 'satisfied';

export type WebSearchCampaignRequestBudget = {
  readonly maxRequestsPerRun: typeof WEB_SEARCH_MAX_REQUESTS_PER_RUN;
  readonly requestsIssued: number;
  readonly queriesPlanned: number;
  readonly queriesExecuted: number;
  readonly capApplied: boolean;
};

export type WebSearchCampaignResult = {
  readonly kind: typeof WEB_SEARCH_CAMPAIGN_KIND;
  readonly adapterId: typeof SEARXNG_SEARCH_ADAPTER_ID | typeof BRAVE_SEARCH_ADAPTER_ID;
  readonly campaign: DiscoveryCampaignResult;
  readonly yield: CampaignYieldSummary;
  readonly waybackGate: WebSearchWaybackGate;
  readonly requestBudget: WebSearchCampaignRequestBudget;
  readonly queryText: string;
  readonly rejectedResultCount: number;
  readonly storageTermsGate: {
    readonly confirmedAtRunTime: true;
    readonly providerDecisionConfirmedInWriting: typeof WEB_SEARCH_PROVIDER_DECISION.storageTermsConfirmedInWriting;
  };
  readonly editorialReviews?: readonly EditorialReviewResult[];
  readonly completedAt: string;
};

export type RunWebSearchCampaignInput = {
  readonly providerConfig: WebSearchProviderConfig;
  /**
   * Provider JSON payload. Prefer `searchResponseRaw`. `braveResponseRaw` is kept as a
   * deprecated alias for Brave-era call sites.
   */
  readonly searchResponseRaw?: unknown;
  readonly braveResponseRaw?: unknown;
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly queryText?: string;
  readonly pack?: QueryPack;
  readonly geographicSeeds?: readonly WebSearchGeographicSeed[];
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly requireWaybackCapture?: boolean;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly editorialHook?: CampaignEditorialHook;
};

function defaultWebSearchPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-web-search-discovery',
    displayName: 'Web search discovery',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'freedom rider', termClass: 'positive' },
      { text: 'civil rights activist', termClass: 'positive' },
      { text: 'Montgomery', termClass: 'geographic' },
      { text: 'Alabama', termClass: 'geographic' },
    ],
  });
}

function defaultGeographicSeeds(): readonly WebSearchGeographicSeed[] {
  return [{ state: 'Alabama', county: 'Montgomery County' }];
}

function resolveMaxQueries(maxQueries: number | undefined): number {
  const cap = maxQueries ?? WEB_SEARCH_MAX_REQUESTS_PER_RUN;
  if (cap < 1) {
    throw new Error('maxQueries must be at least 1');
  }
  if (cap > WEB_SEARCH_MAX_REQUESTS_PER_RUN) {
    throw new Error(
      `maxQueries cannot exceed roster cap of ${WEB_SEARCH_MAX_REQUESTS_PER_RUN} requests per run`,
    );
  }
  return cap;
}

export function assertWebSearchCampaignStorageTerms(config: WebSearchProviderConfig): void {
  assertStorageTermsConfirmed(config);
}

function parseProviderResponse(provider: WebSearchProvider, raw: unknown): WebSearchParsedBatch {
  if (provider === 'searxng') return parseSearxngSearchResponse(raw);
  if (provider === 'brave') return parseBraveSearchResponse(raw);
  throw new Error(`Web search campaign does not yet support provider=${provider}`);
}

function ensureApprovedRegistry(
  store: SourceRegistryStore,
  provider: WebSearchProvider,
  now: string,
): SourceRegistryEntry {
  if (provider === 'exa') {
    throw new Error('Exa web-search campaign wiring is not implemented');
  }
  const adapterId = webSearchAdapterId(provider);
  const regId = `reg_${adapterId}_campaign`;
  const existing = store.get(regId);
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract =
    provider === 'searxng'
      ? createSearxngSearchAdapterContract()
      : createBraveSearchAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: `src_${adapterId}_campaign`,
    organizationId: 'org_community',
    displayName: contract.displayName,
    classification: contract.classification,
    adapterId,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: `adapter:${adapterId}`,
    createdAt: now,
    updatedAt: now,
  };
  if (!existing) {
    registerSource(store, {
      id: regId,
      contract,
      evidenceSource,
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: regId,
    approvedBy: 'web-search-campaign',
    approvedAt: now,
  });
}

function resolveWaybackGate(input: {
  readonly requireWaybackCapture: boolean;
  readonly capturePointersProvided: boolean;
}): WebSearchWaybackGate {
  if (input.capturePointersProvided) {
    return 'satisfied';
  }
  return input.requireWaybackCapture ? 'required_unmet' : 'deferred';
}

/**
 * Run a fixture-first web-search discovery campaign. Private candidates only — no publish.
 */
export async function runWebSearchCampaign(
  input: RunWebSearchCampaignInput,
): Promise<WebSearchCampaignResult> {
  assertCampaignCannotPublish();
  assertWebSearchCampaignStorageTerms(input.providerConfig);

  const provider = input.providerConfig.provider;
  if (provider !== 'searxng' && provider !== 'brave') {
    throw new Error(`Web search campaign supports searxng|brave in v1; got provider=${provider}`);
  }

  const responseRaw = input.searchResponseRaw ?? input.braveResponseRaw;
  if (responseRaw === undefined) {
    throw new Error('searchResponseRaw (or legacy braveResponseRaw) is required');
  }

  const maxQueries = resolveMaxQueries(input.maxQueries);
  const pack = input.pack ?? defaultWebSearchPack(input.stampedAt);
  const seeds = input.geographicSeeds ?? defaultGeographicSeeds();
  const allQueryTexts = buildWebSearchQueryTexts({ pack, geographicSeeds: seeds });
  const queryTexts = allQueryTexts.slice(0, maxQueries);
  const capApplied = allQueryTexts.length > maxQueries;
  const queryText =
    input.queryText?.trim() || queryTexts[0] || 'freedom rider Montgomery County Alabama';

  const parsed = parseProviderResponse(provider, responseRaw);
  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();
  const registryEntry = ensureApprovedRegistry(sourceRegistry, provider, input.stampedAt);
  const runId = input.runId ?? `run_web_search_${input.stampedAt}`;
  const adapterId = provider === 'searxng' ? SEARXNG_SEARCH_ADAPTER_ID : BRAVE_SEARCH_ADAPTER_ID;

  const queryProvenance = stampExternalQueryProvenance({
    provider,
    queryText,
    executedAt: input.stampedAt,
    planTermsVersion: input.providerConfig.planTermsVersion,
  });

  const adapterRecords = normalizeWebSearchBatch({
    results: parsed.results,
    registryEntry,
    runId,
    capturedAt: input.stampedAt,
    config: input.providerConfig,
    queryProvenance,
  });

  const maxCandidates = Math.min(
    input.maxCandidates ?? WEB_SEARCH_MAX_REQUESTS_PER_RUN,
    WEB_SEARCH_MAX_REQUESTS_PER_RUN,
  );

  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_web_search_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: { countries: ['US'], adapterIds: [adapterId] },
      continueOnQuarantine: true,
    }),
    records: adapterRecords,
    pack,
    runContext: {
      runId,
      adapterId,
      startedAt: input.stampedAt,
      entityKind: pack.entityKind,
      theme: pack.theme,
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

  const requireWayback = input.requireWaybackCapture !== false;
  const waybackGate = resolveWaybackGate({
    requireWaybackCapture: requireWayback,
    capturePointersProvided: false,
  });

  const editorialReviews = input.editorialHook
    ? await runOptionalEditorialHook(input.editorialHook, survivors.map(toEditorialLeadPreview))
    : undefined;

  return {
    kind: WEB_SEARCH_CAMPAIGN_KIND,
    adapterId,
    campaign,
    yield: yieldSummary,
    waybackGate,
    requestBudget: {
      maxRequestsPerRun: WEB_SEARCH_MAX_REQUESTS_PER_RUN,
      requestsIssued: 1,
      queriesPlanned: allQueryTexts.length,
      queriesExecuted: 1,
      capApplied,
    },
    queryText,
    rejectedResultCount: parsed.rejected.length,
    storageTermsGate: {
      confirmedAtRunTime: true,
      providerDecisionConfirmedInWriting:
        WEB_SEARCH_PROVIDER_DECISION.storageTermsConfirmedInWriting,
    },
    ...(editorialReviews !== undefined && editorialReviews.length > 0 ? { editorialReviews } : {}),
    completedAt: input.completedAt,
  };
}

/**
 * Generic RSS/Atom discovery campaign (hourly lane).
 *
 * Processes operator-vetted feed XML into private discovery candidates. Curated community
 * feeds (The American Blackstory) are excluded by default so this job does not double-schedule
 * with the weekly community-obscurity lane.
 *
 * Ranking: accepted survivors are ordered by title (locale-aware ascending). Editorial/LLM review
 * is an optional post-rank hook only — never part of ingest. Never publishes.
 */
import {
  createRssAdapterContract,
  createInMemoryFeedRegistry,
  normalizeFeedXml,
  parseRssOrAtomFeed,
  CURATED_COMMUNITY_FEED_SEEDS,
  type FeedRegistryEntry,
  type FeedRegistryStore,
} from '../adapters/rss/index.js';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import type { EvidenceSource } from '../provenance/source.js';
import { createDiscoveryCampaignConfig } from './campaign.js';
import {
  listCampaignSurvivors,
  partitionSurvivorsByRelevance,
  runOptionalEditorialHook,
  summarizeCampaignYield,
  toEditorialLeadPreview,
  type CampaignEditorialHook,
  type CampaignYieldSummary,
  type EditorialReviewResult,
} from './campaign-runner.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type { ResolutionProfile } from '../resolution/types.js';
import type { DiscoveryCampaignResult, DiscoveryCandidateRecord } from './types.js';
import { buildQueryPack, type QueryPack } from '../query-packs/index.js';
import type { AuditActor } from '../audit/index.js';

export const RSS_DISCOVERY_CAMPAIGN_KIND = 'rss-discovery.v1' as const;

const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_MAX_QUARANTINED = 40;
const DEFAULT_MAX_DEAD_LETTER = 10;
const DEFAULT_MAX_RETRIES_PER_CANDIDATE = 2;

export type RssDiscoveryRankedLead = {
  readonly candidateId: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly classification?: string;
};

export type RssDiscoveryCampaignResult = {
  readonly kind: typeof RSS_DISCOVERY_CAMPAIGN_KIND;
  readonly feedIds: readonly string[];
  readonly excludedCuratedFeedIds: readonly string[];
  readonly campaign: DiscoveryCampaignResult;
  readonly ranked: readonly RssDiscoveryRankedLead[];
  readonly yield: CampaignYieldSummary;
  readonly editorialResults?: readonly EditorialReviewResult[];
  readonly completedAt: string;
};

export type RunRssDiscoveryCampaignInput = {
  /** Feed XML keyed by feed registry id (e.g. feed_piedmont_historical_society). */
  readonly feedXmlByFeedId: ReadonlyMap<string, string>;
  /** When true (default), skip CURATED_COMMUNITY_FEED_SEEDS so ABS is not double-scheduled. */
  readonly excludeCuratedCommunityFeeds?: boolean;
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly pack?: QueryPack;
  readonly maxCandidates?: number;
  readonly feedRegistry?: FeedRegistryStore;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly operatorActor?: AuditActor;
  readonly editorialHook?: CampaignEditorialHook;
  readonly enableRelevancePartition?: boolean;
  /** Optional catalog profiles for soft propose/review match (never hard-exclude). */
  readonly catalogProfiles?: readonly ResolutionProfile[];
};

function defaultRssDiscoveryPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-rss-discovery',
    displayName: 'RSS source discovery',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'Freedmen', termClass: 'historical' },
      { text: 'Reconstruction', termClass: 'historical' },
      { text: 'Rosewood', termClass: 'geographic' },
      { text: 'Piedmont', termClass: 'geographic' },
      { text: 'oral history', termClass: 'modern' },
    ],
  });
}

function ensureApprovedRssRegistry(
  store: SourceRegistryStore,
  now: string,
): SourceRegistryEntry {
  const existing = store.get('reg_rss_discovery');
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract = createRssAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_rss_discovery',
    organizationId: 'org_discovery',
    displayName: 'Generic RSS/Atom discovery (hourly lane)',
    classification: 'community_oral',
    adapterId: contract.adapterId,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:rss',
    createdAt: now,
    updatedAt: now,
  };
  if (!existing) {
    registerSource(store, {
      id: 'reg_rss_discovery',
      contract,
      evidenceSource,
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: 'reg_rss_discovery',
    approvedBy: 'rss-discovery-campaign',
    approvedAt: now,
  });
}

function deriveFeedUrl(feedId: string, xml: string): string {
  const parsed = parseRssOrAtomFeed(xml);
  const itemLink = parsed.items.find((item) => item.link !== undefined)?.link;
  if (itemLink) {
    try {
      const origin = new URL(itemLink).origin;
      return `${origin}/feed.xml`;
    } catch {
      // fall through to internal placeholder
    }
  }
  return `https://feeds.blackstory.internal/${feedId}/feed.xml`;
}

function synthesizeFeedEntry(
  feedId: string,
  xml: string,
  now: string,
  actorId: string,
): FeedRegistryEntry {
  const parsed = parseRssOrAtomFeed(xml);
  return {
    id: feedId,
    feedUrl: deriveFeedUrl(feedId, xml),
    displayName: parsed.channelTitle ?? feedId,
    classification: 'community_oral',
    institutionType: 'historical_society',
    status: 'active',
    revision: 1,
    addedAt: now,
    addedBy: actorId,
  };
}

function resolveFeedEntry(
  feedId: string,
  xml: string,
  feedRegistry: FeedRegistryStore,
  now: string,
  actorId: string,
): FeedRegistryEntry {
  const existing = feedRegistry.get(feedId);
  if (existing && existing.status === 'active') {
    return existing;
  }
  return synthesizeFeedEntry(feedId, xml, now, actorId);
}

/** Rank survivors by title ascending (locale-aware). Stable tie-break on candidate id. */
function rankSurvivorsByTitle(
  survivors: readonly DiscoveryCandidateRecord[],
): readonly DiscoveryCandidateRecord[] {
  return [...survivors].sort((left, right) => {
    const titleCompare = (left.adapterRecord.title ?? '').localeCompare(
      right.adapterRecord.title ?? '',
      'en',
      { sensitivity: 'base' },
    );
    if (titleCompare !== 0) return titleCompare;
    return left.id.localeCompare(right.id);
  });
}

function toRankedLead(candidate: DiscoveryCandidateRecord): RssDiscoveryRankedLead {
  return {
    candidateId: candidate.id,
    ...(candidate.adapterRecord.title !== undefined ? { title: candidate.adapterRecord.title } : {}),
    ...(candidate.adapterRecord.canonicalUrl !== undefined
      ? { canonicalUrl: candidate.adapterRecord.canonicalUrl }
      : {}),
    ...(candidate.adapterRecord.classification !== undefined
      ? { classification: candidate.adapterRecord.classification }
      : {}),
  };
}

/**
 * Run generic RSS feeds through discovery and rank private survivors by title.
 * Curated ABS feeds are excluded unless `excludeCuratedCommunityFeeds` is explicitly false.
 */
export async function runRssDiscoveryCampaign(
  input: RunRssDiscoveryCampaignInput,
): Promise<RssDiscoveryCampaignResult> {
  const actor: AuditActor = input.operatorActor ?? {
    id: 'rss-discovery-campaign',
    type: 'system',
  };
  const excludeCurated = input.excludeCuratedCommunityFeeds !== false;
  const curatedIds = new Set(CURATED_COMMUNITY_FEED_SEEDS.map((seed) => seed.id));

  const feedRegistry = input.feedRegistry ?? createInMemoryFeedRegistry();
  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();
  const registryEntry = ensureApprovedRssRegistry(sourceRegistry, input.stampedAt);

  const feedIds: string[] = [];
  const excludedCuratedFeedIds: string[] = [];
  const records: ReturnType<typeof normalizeFeedXml>[number][] = [];

  for (const [feedId, xml] of input.feedXmlByFeedId) {
    if (excludeCurated && curatedIds.has(feedId)) {
      excludedCuratedFeedIds.push(feedId);
      continue;
    }
    feedIds.push(feedId);
    const feed = resolveFeedEntry(feedId, xml, feedRegistry, input.stampedAt, actor.id);
    records.push(
      ...normalizeFeedXml({
        feed,
        xml,
        registryEntry,
        runId: input.runId ?? `run_rss_discovery_${input.stampedAt}`,
        capturedAt: input.stampedAt,
      }),
    );
  }

  if (records.length === 0) {
    throw new Error(
      'RSS discovery campaign received no eligible feed XML after curated exclusion',
    );
  }

  const pack = input.pack ?? defaultRssDiscoveryPack(input.stampedAt);
  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_rss_discovery_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates: input.maxCandidates ?? DEFAULT_MAX_CANDIDATES,
        maxQuarantined: DEFAULT_MAX_QUARANTINED,
        maxDeadLetter: DEFAULT_MAX_DEAD_LETTER,
        maxRetriesPerCandidate: DEFAULT_MAX_RETRIES_PER_CANDIDATE,
      },
      boundaries: { countries: ['US'], adapterIds: ['rss'] },
      continueOnQuarantine: true,
    }),
    records,
    pack,
    runContext: {
      runId: input.runId ?? `run_rss_discovery_${input.stampedAt}`,
      adapterId: 'rss',
      startedAt: input.stampedAt,
      entityKind: 'person',
      theme: 'civil_rights',
    },
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
    ...(input.catalogProfiles !== undefined
      ? { catalog: { profiles: input.catalogProfiles } }
      : {}),
  };

  const campaign = runDiscoveryCampaign(campaignInput);
  const survivors = listCampaignSurvivors(campaign);
  const partition = partitionSurvivorsByRelevance({
    survivors,
    assessedAt: input.completedAt,
    enabled: input.enableRelevancePartition === true,
  });
  const rankedCandidates = rankSurvivorsByTitle(partition.researchEligible);
  const ranked = rankedCandidates.map(toRankedLead);

  const yieldSummary = summarizeCampaignYield({
    campaign,
    graylistedCount: partition.graylisted.length,
    researchEligibleCount: partition.researchEligible.length,
  });

  const editorialResults = await runOptionalEditorialHook(
    input.editorialHook,
    rankedCandidates.map(toEditorialLeadPreview),
  );

  return {
    kind: RSS_DISCOVERY_CAMPAIGN_KIND,
    feedIds,
    excludedCuratedFeedIds,
    campaign,
    ranked,
    yield: yieldSummary,
    ...(editorialResults.length > 0 ? { editorialResults } : {}),
    completedAt: input.completedAt,
  };
}

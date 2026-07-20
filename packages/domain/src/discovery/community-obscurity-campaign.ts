/**
 * Curated community-feed discovery + obscurity ranking campaign.
 *
 * Extra care: snippet-only candidates, authority harvest on, obscurity scored with disclaimer,
 * never publishes. Designed for weekly scheduled runs and on-demand operator dry-runs.
 */
import {
  createRssAdapterContract,
  getCuratedCommunityFeedSeed,
  normalizeFeedXml,
  seedCuratedCommunityFeeds,
  createInMemoryFeedRegistry,
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
import type { ResolutionProfile } from '../resolution/types.js';
import { createDiscoveryCampaignConfig } from './campaign.js';
import {
  OBSCURITY_METHODOLOGY_DISCLAIMER,
  rankByObscurity,
  scoreObscurity,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
} from './obscurity.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type {
  AuthorityFollowUpLead,
  DiscoveryCampaignResult,
  DiscoveryCandidateRecord,
} from './types.js';
import { buildQueryPack, type QueryPack } from '../query-packs/index.js';
import type { AuditActor } from '../audit/index.js';

export const COMMUNITY_OBSCURITY_CAMPAIGN_KIND = 'community-obscurity.v1' as const;

export type CommunityObscurityRankedLead = {
  readonly candidateId: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly classification?: string;
  readonly catalogMatch?: DiscoveryCandidateRecord['catalogMatch'];
  readonly obscurity: ObscurityAssessment;
  readonly authorityFollowUpCount: number;
};

export type CommunityObscurityCampaignResult = {
  readonly kind: typeof COMMUNITY_OBSCURITY_CAMPAIGN_KIND;
  readonly feedIds: readonly string[];
  readonly campaign: DiscoveryCampaignResult;
  readonly ranked: readonly CommunityObscurityRankedLead[];
  readonly authorityFollowUps: readonly AuthorityFollowUpLead[];
  readonly disclaimer: typeof OBSCURITY_METHODOLOGY_DISCLAIMER;
  readonly completedAt: string;
};

export type RunCommunityObscurityCampaignInput = {
  /** Feed XML keyed by curated feed id (e.g. feed_the_american_blackstory). */
  readonly feedXmlByFeedId: ReadonlyMap<string, string>;
  readonly catalogTitles: readonly string[];
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly pack?: QueryPack;
  readonly maxCandidates?: number;
  /** Optional pre-seeded stores; tests inject these. */
  readonly feedRegistry?: FeedRegistryStore;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly operatorActor?: AuditActor;
};

function defaultCommunityObscurityPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-community-obscurity',
    displayName: 'Community obscurity discovery',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'Buffalo Soldiers', termClass: 'historical' },
      { text: 'Stonewall', termClass: 'historical' },
      { text: 'Piedmont', termClass: 'geographic' },
      { text: 'Yosemite', termClass: 'geographic' },
      { text: 'school', termClass: 'modern' },
    ],
  });
}

function ensureApprovedRssRegistry(store: SourceRegistryStore, now: string): SourceRegistryEntry {
  const existing = store.get('reg_rss_community_obscurity');
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract = createRssAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_rss_community_obscurity',
    organizationId: 'org_community',
    displayName: 'Curated community RSS (obscurity lane)',
    classification: 'self_published',
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
      id: 'reg_rss_community_obscurity',
      contract,
      evidenceSource,
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: 'reg_rss_community_obscurity',
    approvedBy: 'community-obscurity-campaign',
    approvedAt: now,
  });
}

function toFeedRegistryEntry(seedId: string, now: string, actorId: string): FeedRegistryEntry {
  const seed = getCuratedCommunityFeedSeed(seedId);
  if (!seed) {
    throw new Error(`Unknown curated community feed id: ${seedId}`);
  }
  return {
    id: seed.id,
    feedUrl: seed.feedUrl,
    displayName: seed.displayName,
    classification: seed.classification,
    institutionType: seed.institutionType,
    status: 'active',
    revision: 1,
    addedAt: now,
    addedBy: actorId,
    ...(seed.notes !== undefined ? { notes: seed.notes } : {}),
  };
}

/**
 * Run curated community feeds through discovery (authority harvest + optional catalog match)
 * and rank accepted survivors by obscurity. Private candidates only — no publish path.
 */
export function runCommunityObscurityCampaign(
  input: RunCommunityObscurityCampaignInput,
): CommunityObscurityCampaignResult {
  const actor: AuditActor = input.operatorActor ?? {
    id: 'community-obscurity-campaign',
    type: 'system',
  };
  const feedRegistry = input.feedRegistry ?? createInMemoryFeedRegistry();
  seedCuratedCommunityFeeds(feedRegistry, {
    actor,
    reason: 'Community obscurity campaign seed',
    requestId: `req_${input.runId ?? 'community_obscurity'}`,
    correlationId: `corr_${input.runId ?? 'community_obscurity'}`,
    now: input.stampedAt,
  });

  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();
  const registryEntry = ensureApprovedRssRegistry(sourceRegistry, input.stampedAt);

  const records: ReturnType<typeof normalizeFeedXml>[number][] = [];
  const feedIds: string[] = [];
  for (const seed of CURATED_COMMUNITY_FEED_SEEDS) {
    const xml = input.feedXmlByFeedId.get(seed.id);
    if (xml === undefined) continue;
    feedIds.push(seed.id);
    const feed =
      feedRegistry.get(seed.id) ?? toFeedRegistryEntry(seed.id, input.stampedAt, actor.id);
    records.push(
      ...normalizeFeedXml({
        feed,
        xml,
        registryEntry,
        runId: input.runId ?? `run_community_obscurity_${input.stampedAt}`,
        capturedAt: input.stampedAt,
      }),
    );
  }

  if (records.length === 0) {
    throw new Error('Community obscurity campaign received no feed XML for curated seeds');
  }

  const pack = input.pack ?? defaultCommunityObscurityPack(input.stampedAt);
  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_community_obscurity_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates: input.maxCandidates ?? 100,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: { countries: ['US'], adapterIds: ['rss'] },
      continueOnQuarantine: true,
    }),
    records,
    pack,
    runContext: {
      runId: input.runId ?? `run_community_obscurity_${input.stampedAt}`,
      adapterId: 'rss',
      startedAt: input.stampedAt,
      entityKind: 'person',
      theme: 'civil_rights',
    },
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
    authorityHarvest: { enabled: true },
    ...(input.catalogProfiles !== undefined
      ? { catalog: { profiles: input.catalogProfiles } }
      : {}),
  };

  const campaign = runDiscoveryCampaign(campaignInput);
  const corpus: ObscurityReferenceCorpus = { catalogTitles: input.catalogTitles };
  const assessments = campaign.candidates
    .filter((candidate) => candidate.status === 'accepted' || candidate.status === 'merged')
    .map((candidate) =>
      scoreObscurity({
        candidate,
        corpus,
        assessedAt: input.completedAt,
      }),
    );
  const rankedAssessments = rankByObscurity(assessments);
  const followUps = campaign.authorityFollowUps ?? [];
  const followUpCounts = new Map<string, number>();
  for (const lead of followUps) {
    followUpCounts.set(
      lead.parentCandidateId,
      (followUpCounts.get(lead.parentCandidateId) ?? 0) + 1,
    );
  }

  const ranked: CommunityObscurityRankedLead[] = rankedAssessments.map((obscurity) => {
    const candidate = campaign.candidates.find((entry) => entry.id === obscurity.candidateId)!;
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
      ...(candidate.catalogMatch !== undefined ? { catalogMatch: candidate.catalogMatch } : {}),
      obscurity,
      authorityFollowUpCount: followUpCounts.get(candidate.id) ?? 0,
    };
  });

  return {
    kind: COMMUNITY_OBSCURITY_CAMPAIGN_KIND,
    feedIds,
    campaign,
    ranked,
    authorityFollowUps: followUps,
    disclaimer: OBSCURITY_METHODOLOGY_DISCLAIMER,
    completedAt: input.completedAt,
  };
}

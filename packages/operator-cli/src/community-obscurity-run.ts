/**
 * Operator CLI wrapper for curated community-feed obscurity discovery.
 *
 * Safe by default: reads feed XML from disk (or multiple --feed-xml feedId=path pairs), runs the
 * real domain campaign + obscurity ranking, prints JSON. Never publishes. Live network fetch is
 * out of scope for this command — pass a previously downloaded feed file.
 */
import {
  runCommunityObscurityCampaign,
  type CommunityObscurityCampaignResult,
  type ResolutionProfile,
} from '@repo/domain';

export type CommunityObscurityRunInput = {
  readonly feedXmlByFeedId: ReadonlyMap<string, string>;
  readonly catalogTitles: readonly string[];
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly campaignId?: string;
  readonly runId?: string;
  readonly maxCandidates?: number;
  readonly nowIso: string;
};

export type CommunityObscurityRunSummary = {
  readonly kind: CommunityObscurityCampaignResult['kind'];
  readonly feedIds: readonly string[];
  readonly acceptedCount: number;
  readonly rankedTop: readonly {
    readonly title?: string;
    readonly score: number;
    readonly band: string;
    readonly authorityFollowUpCount: number;
    readonly catalogMatch?: string;
  }[];
  readonly authorityFollowUpTotal: number;
  readonly disclaimerId: string;
  readonly completedAt: string;
};

export function summarizeCommunityObscurityRun(
  result: CommunityObscurityCampaignResult,
  topN = 10,
): CommunityObscurityRunSummary {
  return {
    kind: result.kind,
    feedIds: result.feedIds,
    acceptedCount: result.campaign.acceptedCount,
    rankedTop: result.ranked.slice(0, topN).map((lead) => ({
      ...(lead.title !== undefined ? { title: lead.title } : {}),
      score: lead.obscurity.score,
      band: lead.obscurity.band,
      authorityFollowUpCount: lead.authorityFollowUpCount,
      ...(lead.catalogMatch?.outcome !== undefined
        ? { catalogMatch: lead.catalogMatch.outcome }
        : {}),
    })),
    authorityFollowUpTotal: result.authorityFollowUps.length,
    disclaimerId: result.disclaimer.id,
    completedAt: result.completedAt,
  };
}

export function runCommunityObscurityOperatorCampaign(input: CommunityObscurityRunInput): {
  readonly result: CommunityObscurityCampaignResult;
  readonly summary: CommunityObscurityRunSummary;
} {
  const result = runCommunityObscurityCampaign({
    feedXmlByFeedId: input.feedXmlByFeedId,
    catalogTitles: input.catalogTitles,
    stampedAt: input.nowIso,
    completedAt: input.nowIso,
    ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
    ...(input.catalogProfiles !== undefined ? { catalogProfiles: input.catalogProfiles } : {}),
  });
  return { result, summary: summarizeCommunityObscurityRun(result) };
}

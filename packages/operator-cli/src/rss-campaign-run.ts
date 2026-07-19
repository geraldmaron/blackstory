/**
 * Operator CLI wrapper for generic RSS discovery campaigns.
 *
 * Safe by default: reads feed XML from disk (or multiple --feed-xml feedId=path pairs), runs the
 * real domain campaign, prints JSON. Never publishes. Curated ABS feeds are excluded unless
 * --include-curated is passed. Live network fetch is out of scope — pass downloaded feed files.
 */
import {
  runRssDiscoveryCampaign,
  type RssDiscoveryCampaignResult,
} from '@repo/domain';

export type RssCampaignRunInput = {
  readonly feedXmlByFeedId: ReadonlyMap<string, string>;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly maxCandidates?: number;
  /** When true, do not exclude curated community feeds (ABS). */
  readonly includeCuratedCommunityFeeds?: boolean;
  readonly nowIso: string;
};

export type RssCampaignRunSummary = {
  readonly kind: RssDiscoveryCampaignResult['kind'];
  readonly feedIds: readonly string[];
  readonly excludedCuratedFeedIds: readonly string[];
  readonly acceptedCount: number;
  readonly survivors: number;
  readonly rankedTop: readonly {
    readonly title?: string;
    readonly candidateId: string;
    readonly canonicalUrl?: string;
  }[];
  readonly completedAt: string;
};

export function summarizeRssCampaignRun(
  result: RssDiscoveryCampaignResult,
  topN = 10,
): RssCampaignRunSummary {
  return {
    kind: result.kind,
    feedIds: result.feedIds,
    excludedCuratedFeedIds: result.excludedCuratedFeedIds,
    acceptedCount: result.campaign.acceptedCount,
    survivors: result.yield.survivors,
    rankedTop: result.ranked.slice(0, topN).map((lead) => ({
      candidateId: lead.candidateId,
      ...(lead.title !== undefined ? { title: lead.title } : {}),
      ...(lead.canonicalUrl !== undefined ? { canonicalUrl: lead.canonicalUrl } : {}),
    })),
    completedAt: result.completedAt,
  };
}

export async function runRssOperatorCampaign(
  input: RssCampaignRunInput,
): Promise<{
  readonly result: RssDiscoveryCampaignResult;
  readonly summary: RssCampaignRunSummary;
}> {
  const result = await runRssDiscoveryCampaign({
    feedXmlByFeedId: input.feedXmlByFeedId,
    stampedAt: input.nowIso,
    completedAt: input.nowIso,
    ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
    ...(input.includeCuratedCommunityFeeds === true
      ? { excludeCuratedCommunityFeeds: false }
      : {}),
  });
  return { result, summary: summarizeRssCampaignRun(result) };
}

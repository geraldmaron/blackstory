/**
 * REAL roster entry: generic RSS/Atom discovery campaign (hourly lane).
 *
 * Wraps @repo/domain's runRssDiscoveryCampaign. Curated ABS feeds are excluded by default
 * so this job does not double-schedule with community-obscurity-discovery. Private candidates
 * only — publicEffect none. Feed XML is injected by the dispatcher (fixture path for local/CI;
 * live fetch later behind SSRF-safe client).
 */
import {
  runRssDiscoveryCampaign,
  type RssDiscoveryCampaignResult,
  type ResolutionProfile,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const RSS_DISCOVERY_CAMPAIGN_JOB_ID = 'discovery-campaign-rss' as const;

export type RssDiscoveryCampaignJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  /** Feed XML keyed by feed registry id. */
  readonly feedXmlByFeedId: ReadonlyMap<string, string>;
  readonly maxCandidates?: number;
  /** Opt-in to include curated community feeds (ABS). Default excludes them. */
  readonly includeCuratedCommunityFeeds?: boolean;
  /** Soft propose/review catalog match — never hard-excludes known entities. */
  readonly catalogProfiles?: readonly ResolutionProfile[];
};

export type RssDiscoveryCampaignJobResult = {
  readonly run: JobRunRecord;
  readonly campaign: RssDiscoveryCampaignResult;
};

export async function runRssDiscoveryCampaignJob(
  input: RssDiscoveryCampaignJobInput,
): Promise<RssDiscoveryCampaignJobResult> {
  const started = startJobRun({
    jobId: RSS_DISCOVERY_CAMPAIGN_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const campaign = await runRssDiscoveryCampaign({
    feedXmlByFeedId: input.feedXmlByFeedId,
    stampedAt: input.startedAt,
    completedAt: input.completedAt,
    campaignId: `camp_${RSS_DISCOVERY_CAMPAIGN_JOB_ID}_${input.jobRunId}`,
    runId: input.jobRunId,
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
    ...(input.includeCuratedCommunityFeeds === true ? { excludeCuratedCommunityFeeds: false } : {}),
    ...(input.catalogProfiles !== undefined ? { catalogProfiles: input.catalogProfiles } : {}),
  });
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.maxCandidates ?? 100,
    itemsProcessed: campaign.ranked.length,
    issues: [],
  });
  return { run, campaign };
}

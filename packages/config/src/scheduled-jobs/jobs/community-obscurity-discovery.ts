/**
 * REAL roster entry: curated community-feed obscurity discovery.
 *
 * Wraps @repo/domain's runCommunityObscurityCampaign (ABS + care policy + authority harvest +
 * obscurity.v1 ranking). Private candidates only — publicEffect none. Feed XML is injected by
 * the dispatcher (fixture path for local/CI; live fetch later behind SSRF-safe client).
 */
import {
  runCommunityObscurityCampaign,
  type CommunityObscurityCampaignResult,
  type ResolutionProfile,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID = 'community-obscurity-discovery' as const;

export type CommunityObscurityDiscoveryJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  /** Feed XML keyed by curated feed id. */
  readonly feedXmlByFeedId: ReadonlyMap<string, string>;
  readonly catalogTitles: readonly string[];
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly maxCandidates?: number;
};

export type CommunityObscurityDiscoveryJobResult = {
  readonly run: JobRunRecord;
  readonly campaign: CommunityObscurityCampaignResult;
};

export function runCommunityObscurityDiscoveryJob(
  input: CommunityObscurityDiscoveryJobInput,
): CommunityObscurityDiscoveryJobResult {
  const started = startJobRun({
    jobId: COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const campaign = runCommunityObscurityCampaign({
    feedXmlByFeedId: input.feedXmlByFeedId,
    catalogTitles: input.catalogTitles,
    stampedAt: input.startedAt,
    completedAt: input.completedAt,
    campaignId: `camp_${COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID}_${input.jobRunId}`,
    runId: input.jobRunId,
    ...(input.catalogProfiles !== undefined ? { catalogProfiles: input.catalogProfiles } : {}),
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
  });
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.maxCandidates ?? 100,
    itemsProcessed: campaign.ranked.length,
    issues: [],
  });
  return { run, campaign };
}

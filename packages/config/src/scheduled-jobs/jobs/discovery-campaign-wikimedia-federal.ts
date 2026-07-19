/**
 * REAL roster entry: Wikimedia + federal fan-out discovery campaign.
 *
 * Wraps @repo/domain's runWikimediaFederalCampaign (per-adapter normalize, sub-budgets,
 * shared discovery gate). Private candidates only — publicEffect none. Fixture paths are
 * default for local/CI; live fetch wiring stays behind adapter clients.
 */
import {
  runWikimediaFederalCampaign,
  type WikimediaFederalCampaignResult,
  type ResolutionProfile,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID =
  'discovery-campaign-wikimedia-federal' as const;

export type DiscoveryCampaignWikimediaFederalJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly maxCandidates?: number;
  readonly catalogProfiles?: readonly ResolutionProfile[];
};

export type DiscoveryCampaignWikimediaFederalJobResult = {
  readonly run: JobRunRecord;
  readonly campaign: WikimediaFederalCampaignResult;
};

export async function runDiscoveryCampaignWikimediaFederalJob(
  input: DiscoveryCampaignWikimediaFederalJobInput,
): Promise<DiscoveryCampaignWikimediaFederalJobResult> {
  const started = startJobRun({
    jobId: DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const campaign = await runWikimediaFederalCampaign({
    stampedAt: input.startedAt,
    completedAt: input.completedAt,
    campaignId: `camp_${DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID}_${input.jobRunId}`,
    runId: input.jobRunId,
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
    ...(input.catalogProfiles !== undefined ? { catalogProfiles: input.catalogProfiles } : {}),
  });
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.maxCandidates ?? 500,
    itemsProcessed: campaign.summary.survivors,
    issues: [],
  });
  return { run, campaign };
}

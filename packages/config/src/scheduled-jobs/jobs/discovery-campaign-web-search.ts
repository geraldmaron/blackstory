/**
 * REAL roster entry: Brave web-search discovery campaign (fixture-first).
 *
 * Wraps domain runWebSearchCampaign with job-run bookkeeping. Private candidates only —
 * publicEffect none. Fixture JSON is injected by the dispatcher (local/CI); live fetch
 * remains behind budget guard + storage-terms confirmation.
 */
import {
  runWebSearchCampaign,
  WEB_SEARCH_MAX_REQUESTS_PER_RUN,
  type WebSearchCampaignResult,
  type WebSearchProviderConfig,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID = 'discovery-campaign-web-search' as const;

export type DiscoveryCampaignWebSearchJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly braveResponseRaw: unknown;
  readonly providerConfig: WebSearchProviderConfig;
  readonly queryText?: string;
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly requireWaybackCapture?: boolean;
};

export type DiscoveryCampaignWebSearchJobResult = {
  readonly run: JobRunRecord;
  readonly campaign: WebSearchCampaignResult;
};

export async function runDiscoveryCampaignWebSearchJob(
  input: DiscoveryCampaignWebSearchJobInput,
): Promise<DiscoveryCampaignWebSearchJobResult> {
  const started = startJobRun({
    jobId: DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });

  const campaign = await runWebSearchCampaign({
    providerConfig: input.providerConfig,
    braveResponseRaw: input.braveResponseRaw,
    stampedAt: input.startedAt,
    completedAt: input.completedAt,
    campaignId: `camp_${DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID}_${input.jobRunId}`,
    runId: input.jobRunId,
    ...(input.queryText !== undefined ? { queryText: input.queryText } : {}),
    ...(input.maxQueries !== undefined ? { maxQueries: input.maxQueries } : {}),
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
    ...(input.requireWaybackCapture !== undefined
      ? { requireWaybackCapture: input.requireWaybackCapture }
      : {}),
  });

  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.maxCandidates ?? WEB_SEARCH_MAX_REQUESTS_PER_RUN,
    itemsProcessed: campaign.yield.survivors,
    costUnits: campaign.requestBudget.requestsIssued,
    issues: campaign.waybackGate === 'required_unmet' ? ['wayback_capture_required_unmet'] : [],
  });

  return { run, campaign };
}

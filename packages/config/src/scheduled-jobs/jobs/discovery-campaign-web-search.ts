/**
 * REAL roster entry: web-search discovery campaign (fixture-first).
 *
 * Preferred provider: SearXNG (self-hosted OSS). Brave remains supported via
 * providerConfig. Wraps domain runWebSearchCampaign with job-run bookkeeping.
 * Private candidates only — publicEffect none.
 */
import {
  runWebSearchCampaign,
  WEB_SEARCH_MAX_REQUESTS_PER_RUN,
  type WebSearchCampaignResult,
  type WebSearchProviderConfig,
  type ResolutionProfile,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID = 'discovery-campaign-web-search' as const;

export type DiscoveryCampaignWebSearchJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  /** Preferred field name for provider JSON (SearXNG or Brave). */
  readonly searchResponseRaw?: unknown;
  /** @deprecated Prefer searchResponseRaw — kept for Brave-era call sites. */
  readonly braveResponseRaw?: unknown;
  readonly providerConfig: WebSearchProviderConfig;
  readonly queryText?: string;
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly requireWaybackCapture?: boolean;
  readonly catalogProfiles?: readonly ResolutionProfile[];
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

  const searchResponseRaw = input.searchResponseRaw ?? input.braveResponseRaw;
  if (searchResponseRaw === undefined) {
    throw new Error('searchResponseRaw (or legacy braveResponseRaw) is required');
  }

  const campaign = await runWebSearchCampaign({
    providerConfig: input.providerConfig,
    searchResponseRaw,
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
    ...(input.catalogProfiles !== undefined ? { catalogProfiles: input.catalogProfiles } : {}),
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

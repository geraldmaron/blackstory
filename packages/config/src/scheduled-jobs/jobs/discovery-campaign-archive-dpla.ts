/**
 * REAL roster entry: Internet Archive + DPLA v2 discovery campaign.
 *
 * Wraps @repo/domain's runArchiveDplaCampaign with fixture-injected search JSON.
 * Private candidates only — publicEffect none. Federal `dpla-items-v1` is never used.
 */
import {
  runArchiveDplaCampaign,
  ARCHIVE_DPLA_CAMPAIGN_KIND,
  type ArchiveDplaCampaignResult,
  type ResolutionProfile,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID = 'discovery-campaign-archive-dpla' as const;

export type DiscoveryCampaignArchiveDplaJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  /** Internet Archive advanced-search JSON (fixture or live response). */
  readonly internetArchiveSearchJson?: unknown;
  /** DPLA v2 search JSON (fixture or live response). */
  readonly dplaSearchJson?: unknown;
  readonly maxCandidates?: number;
  readonly catalogProfiles?: readonly ResolutionProfile[];
};

export type DiscoveryCampaignArchiveDplaJobResult = {
  readonly run: JobRunRecord;
  readonly campaign: ArchiveDplaCampaignResult;
};

export async function runDiscoveryCampaignArchiveDplaJob(
  input: DiscoveryCampaignArchiveDplaJobInput,
): Promise<DiscoveryCampaignArchiveDplaJobResult> {
  const started = startJobRun({
    jobId: DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const campaign = await runArchiveDplaCampaign({
    internetArchiveSearchJson: input.internetArchiveSearchJson,
    dplaSearchJson: input.dplaSearchJson,
    stampedAt: input.startedAt,
    completedAt: input.completedAt,
    campaignId: `camp_${DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID}_${input.jobRunId}`,
    runId: input.jobRunId,
    ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
    ...(input.catalogProfiles !== undefined ? { catalogProfiles: input.catalogProfiles } : {}),
  });
  assertCampaignKind(campaign);
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.maxCandidates ?? 500,
    itemsProcessed: campaign.yield.survivors,
    issues: [],
  });
  return { run, campaign };
}

function assertCampaignKind(campaign: ArchiveDplaCampaignResult): void {
  if (campaign.kind !== ARCHIVE_DPLA_CAMPAIGN_KIND) {
    throw new Error(`Expected campaign kind ${ARCHIVE_DPLA_CAMPAIGN_KIND}, got ${campaign.kind}`);
  }
}

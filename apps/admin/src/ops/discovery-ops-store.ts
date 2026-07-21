/** Admin reads for private Postgres discovery campaign run records. */
import { listDiscoveryCampaignRunsPostgres } from '@/lib/postgres-ops-reads';

export type DiscoveryCampaignRunListItem = {
  readonly id: string;
  readonly jobId: string;
  readonly jobRunId: string;
  readonly status: string;
  readonly mode: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly itemsExpected: number;
  readonly itemsProcessed: number;
  readonly survivors?: number;
  readonly accepted?: number;
  readonly kind?: string;
  readonly errorMessage?: string;
};

export async function listDiscoveryCampaignRuns(limit = 50): Promise<readonly DiscoveryCampaignRunListItem[]> {
  return listDiscoveryCampaignRunsPostgres(limit);
}

export async function tryListDiscoveryCampaignRuns(limit?: number): Promise<readonly DiscoveryCampaignRunListItem[] | null> {
  try {
    return await listDiscoveryCampaignRuns(limit);
  } catch (error) {
    console.error('admin discovery campaign runs list failed', error);
    return null;
  }
}

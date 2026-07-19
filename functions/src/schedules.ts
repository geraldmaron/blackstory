/**
 * Discovery schedule roster mirror for Firebase Functions v2 (ADR-018).
 * Cron expressions match packages/config scheduled-jobs roster; timeouts are
 * capped at the scheduled-function ceiling (1800s).
 */
export const SCHEDULED_FUNCTION_TIMEOUT_CAP_SEC = 1_800 as const;

export const DISCOVERY_SCHEDULES = [
  {
    exportName: 'discoveryCampaignRss',
    jobId: 'discovery-campaign-rss',
    schedule: '0 * * * *',
    rosterTimeoutSec: 900,
    humanReadable: 'hourly',
  },
  {
    exportName: 'communityObscurityDiscovery',
    jobId: 'community-obscurity-discovery',
    schedule: '0 10 * * 0',
    rosterTimeoutSec: 1_800,
    humanReadable: 'weekly, Sundays 10:00 UTC',
  },
  {
    exportName: 'discoveryCampaignWikimediaFederal',
    jobId: 'discovery-campaign-wikimedia-federal',
    schedule: '0 6 * * 1',
    rosterTimeoutSec: 3_600,
    humanReadable: 'weekly, Mondays 06:00 UTC',
  },
  {
    exportName: 'discoveryCampaignArchiveDpla',
    jobId: 'discovery-campaign-archive-dpla',
    schedule: '0 7 * * 2',
    rosterTimeoutSec: 3_600,
    humanReadable: 'weekly, Tuesdays 07:00 UTC',
  },
  {
    exportName: 'discoveryCampaignWebSearch',
    jobId: 'discovery-campaign-web-search',
    schedule: '30 8 * * *',
    rosterTimeoutSec: 3_600,
    humanReadable: 'daily 08:30 UTC',
  },
] as const;

export type DiscoveryScheduleDefinition = (typeof DISCOVERY_SCHEDULES)[number];

/** Caps roster timeout to the Gen2 scheduled-function maximum. */
export function scheduledTimeoutSeconds(rosterTimeoutSec: number): number {
  return Math.min(rosterTimeoutSec, SCHEDULED_FUNCTION_TIMEOUT_CAP_SEC);
}

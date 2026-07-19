/**
 * Firebase Functions v2 entry: scheduled discovery campaign dispatch (ADR-018).
 *
 * Deploy with the research service account (no publish IAM). Default mode is fixture;
 * set DISCOVERY_MODE=live and inject feed/JSON env paths only after operator confirmation.
 * App Hosting must never host these functions.
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { runScheduledDiscovery } from './run-discovery.js';
import { DISCOVERY_SCHEDULES, scheduledTimeoutSeconds } from './schedules.js';

const region = process.env.DISCOVERY_FUNCTIONS_REGION?.trim() || 'us-central1';
const projectId =
  process.env.GCLOUD_PROJECT?.trim() ||
  process.env.GCP_PROJECT?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  'black-book-efaaf';
const researchSa =
  process.env.DISCOVERY_RESEARCH_SA?.trim() || `research@${projectId}.iam.gserviceaccount.com`;

setGlobalOptions({
  region,
  serviceAccount: researchSa,
});

function createScheduledDiscovery(jobId: string, schedule: string, rosterTimeoutSec: number) {
  return onSchedule(
    {
      schedule,
      timeZone: 'UTC',
      timeoutSeconds: scheduledTimeoutSeconds(rosterTimeoutSec),
      memory: '1GiB',
      retryCount: 0,
    },
    async () => {
      const result = await runScheduledDiscovery({ jobId });
      console.log(
        JSON.stringify({
          jobId: result.jobId,
          status: result.status,
          mode: result.mode,
          publicEffect: result.publicEffect,
          summary: result.summary,
        }),
      );
      if (result.status === 'error') {
        throw new Error(result.summary.message ?? `Discovery dispatch failed for ${jobId}`);
      }
    },
  );
}

export const discoveryCampaignRss = createScheduledDiscovery(
  DISCOVERY_SCHEDULES[0].jobId,
  DISCOVERY_SCHEDULES[0].schedule,
  DISCOVERY_SCHEDULES[0].rosterTimeoutSec,
);

export const communityObscurityDiscovery = createScheduledDiscovery(
  DISCOVERY_SCHEDULES[1].jobId,
  DISCOVERY_SCHEDULES[1].schedule,
  DISCOVERY_SCHEDULES[1].rosterTimeoutSec,
);

export const discoveryCampaignWikimediaFederal = createScheduledDiscovery(
  DISCOVERY_SCHEDULES[2].jobId,
  DISCOVERY_SCHEDULES[2].schedule,
  DISCOVERY_SCHEDULES[2].rosterTimeoutSec,
);

export const discoveryCampaignArchiveDpla = createScheduledDiscovery(
  DISCOVERY_SCHEDULES[3].jobId,
  DISCOVERY_SCHEDULES[3].schedule,
  DISCOVERY_SCHEDULES[3].rosterTimeoutSec,
);

export const discoveryCampaignWebSearch = createScheduledDiscovery(
  DISCOVERY_SCHEDULES[4].jobId,
  DISCOVERY_SCHEDULES[4].schedule,
  DISCOVERY_SCHEDULES[4].rosterTimeoutSec,
);

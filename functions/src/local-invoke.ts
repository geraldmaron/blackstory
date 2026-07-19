/**
 * Local one-shot invoke for a discovery scheduled function (no Cloud Scheduler).
 * Usage: DISCOVERY_JOB_ID=discovery-campaign-rss pnpm --filter @repo/functions-discovery start
 */
import { runScheduledDiscovery } from './run-discovery.js';
import { DISCOVERY_SCHEDULES } from './schedules.js';

const jobId =
  process.env.DISCOVERY_JOB_ID?.trim() ?? DISCOVERY_SCHEDULES[0]?.jobId ?? 'discovery-campaign-rss';

const result = await runScheduledDiscovery({
  jobId,
  // Local default: do not require Firestore; allow explicit disengage via env.
  environment: {
    ...process.env,
    DISCOVERY_KILL_SWITCH: process.env.DISCOVERY_KILL_SWITCH ?? 'disengaged',
    DISCOVERY_MODE: process.env.DISCOVERY_MODE ?? 'fixture',
  },
  readFirestoreDoc: async () => ({ exists: false, data: () => undefined }),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.status === 'success' ? 0 : 1;

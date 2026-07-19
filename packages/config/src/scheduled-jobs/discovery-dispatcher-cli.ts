/**
 * Thin argv entrypoint for discovery campaign dispatch (local, CI, and GHA).
 * Parses `--job` and `--mode`, delegates to `dispatchDiscoveryCampaign`, prints JSON
 * summary to stdout, and exits 0 on success or 1 on kill-switch skip / failure.
 */
import { pathToFileURL } from 'node:url';
import {
  DISCOVERY_CAMPAIGN_JOB_IDS,
  dispatchDiscoveryCampaign,
  type DiscoveryCampaignDispatchMode,
  type DiscoveryCampaignJobId,
} from './discovery-dispatcher.js';

function parseArgs(argv: readonly string[]): {
  jobId: DiscoveryCampaignJobId;
  mode: DiscoveryCampaignDispatchMode;
  killSwitchEngaged: boolean;
} {
  let jobId: string | undefined;
  let mode: DiscoveryCampaignDispatchMode = 'fixture';
  let killSwitchEngaged = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--job') {
      jobId = argv[index + 1];
      if (jobId === undefined) {
        throw new Error('--job requires a value');
      }
      index += 1;
      continue;
    }
    if (arg === '--mode') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('--mode requires a value');
      }
      if (value !== 'fixture' && value !== 'live') {
        throw new Error('--mode must be fixture or live');
      }
      mode = value;
      index += 1;
      continue;
    }
    if (arg === '--kill-switch') {
      const value = argv[index + 1];
      if (value !== 'engaged' && value !== 'disengaged') {
        throw new Error('--kill-switch must be engaged or disengaged');
      }
      killSwitchEngaged = value === 'engaged';
      index += 1;
    }
  }

  if (jobId === undefined) {
    throw new Error('--job is required');
  }
  if (!(DISCOVERY_CAMPAIGN_JOB_IDS as readonly string[]).includes(jobId)) {
    throw new Error(
      `Unknown job id "${jobId}"; expected one of ${DISCOVERY_CAMPAIGN_JOB_IDS.join(', ')}`,
    );
  }

  const envKill = process.env.DISCOVERY_KILL_SWITCH?.trim();
  if (envKill === 'engaged') killSwitchEngaged = true;
  if (envKill === 'disengaged') killSwitchEngaged = false;

  return { jobId: jobId as DiscoveryCampaignJobId, mode, killSwitchEngaged };
}

export async function runDiscoveryDispatcherCli(argv: readonly string[]): Promise<number> {
  const { jobId, mode, killSwitchEngaged } = parseArgs(argv);
  const result = await dispatchDiscoveryCampaign({ jobId, mode, killSwitchEngaged });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.status === 'success' ? 0 : 1;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runDiscoveryDispatcherCli(process.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

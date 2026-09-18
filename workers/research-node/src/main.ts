/** Dispatches a bounded discovery job from explicit environment configuration. */
import { pathToFileURL } from 'node:url';
import { dispatchDiscoveryCampaign, type DiscoveryCampaignDispatchMode } from '@repo/config';

function requiredEnv(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readMode(
  environment: Readonly<Record<string, string | undefined>>,
): DiscoveryCampaignDispatchMode {
  const raw = environment.DISCOVERY_MODE?.trim() ?? 'fixture';
  if (raw !== 'fixture' && raw !== 'live') {
    throw new Error('DISCOVERY_MODE must be fixture or live');
  }
  return raw;
}

function readKillSwitchEngaged(environment: Readonly<Record<string, string | undefined>>): boolean {
  const raw = environment.DISCOVERY_KILL_SWITCH?.trim() ?? 'disengaged';
  if (raw !== 'engaged' && raw !== 'disengaged') {
    throw new Error('DISCOVERY_KILL_SWITCH must be engaged or disengaged');
  }
  return raw === 'engaged';
}

async function main(): Promise<number> {
  const jobId = requiredEnv(process.env, 'DISCOVERY_JOB_ID');
  const mode = readMode(process.env);
  const killSwitchEngaged = readKillSwitchEngaged(process.env);
  const jobRunId = process.env.DISCOVERY_JOB_RUN_ID?.trim();
  const nowIso = process.env.DISCOVERY_NOW_ISO?.trim();

  const result = await dispatchDiscoveryCampaign({
    jobId,
    mode,
    ...(jobRunId !== undefined && jobRunId.length > 0 ? { jobRunId } : {}),
    killSwitchEngaged,
    ...(nowIso !== undefined && nowIso.length > 0 ? { nowIso } : {}),
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.status === 'success' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

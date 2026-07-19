/**
 * Cloud Run Job entry for discovery campaign dispatch.
 * Reads DISCOVERY_* environment variables and delegates to dispatchDiscoveryCampaign.
 * Production should use the research@ service account and a Firestore-backed kill switch;
 * discovery jobs produce private candidates only and must never publish.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type DiscoveryCampaignDispatchMode = 'fixture' | 'live';

type DiscoveryCampaignDispatchResult = {
  readonly status: 'success' | 'skipped_kill_switch' | 'error';
  readonly summary: unknown;
  readonly run?: unknown;
};

type DispatchDiscoveryCampaign = (input: {
  readonly jobId: string;
  readonly mode: DiscoveryCampaignDispatchMode;
  readonly jobRunId?: string;
  readonly killSwitchEngaged?: boolean;
  readonly nowIso?: string;
}) => Promise<DiscoveryCampaignDispatchResult>;

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

function readMode(environment: Readonly<Record<string, string | undefined>>): DiscoveryCampaignDispatchMode {
  const raw = environment.DISCOVERY_MODE?.trim() ?? 'fixture';
  if (raw !== 'fixture' && raw !== 'live') {
    throw new Error('DISCOVERY_MODE must be fixture or live');
  }
  return raw;
}

function readKillSwitchEngaged(
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  const raw = environment.DISCOVERY_KILL_SWITCH?.trim() ?? 'disengaged';
  if (raw !== 'engaged' && raw !== 'disengaged') {
    throw new Error('DISCOVERY_KILL_SWITCH must be engaged or disengaged');
  }
  return raw === 'engaged';
}

async function loadDispatcher(): Promise<{ dispatchDiscoveryCampaign: DispatchDiscoveryCampaign }> {
  try {
    const config = (await import('@repo/config')) as {
      dispatchDiscoveryCampaign?: DispatchDiscoveryCampaign;
    };
    if (typeof config.dispatchDiscoveryCampaign === 'function') {
      return { dispatchDiscoveryCampaign: config.dispatchDiscoveryCampaign };
    }
  } catch {
    // Fall through to the scheduled-jobs module once the parent lands it.
  }

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const dispatcherPath = join(
    repoRoot,
    'packages',
    'config',
    'src',
    'scheduled-jobs',
    'discovery-dispatcher.ts',
  );
  return import(pathToFileURL(dispatcherPath).href) as Promise<{
    dispatchDiscoveryCampaign: DispatchDiscoveryCampaign;
  }>;
}

async function main(): Promise<number> {
  const jobId = requiredEnv(process.env, 'DISCOVERY_JOB_ID');
  const mode = readMode(process.env);
  const killSwitchEngaged = readKillSwitchEngaged(process.env);
  const jobRunId = process.env.DISCOVERY_JOB_RUN_ID?.trim();
  const nowIso = process.env.DISCOVERY_NOW_ISO?.trim();

  const { dispatchDiscoveryCampaign } = await loadDispatcher();
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

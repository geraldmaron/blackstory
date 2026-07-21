/** Fail-fast dependency and policy preflight for scheduled research workers. */
import { statfsSync } from 'node:fs';
import { getOpsPostgresPool } from '@repo/data-access';

export type WorkerPreflightCheck = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type WorkerPreflightReport = {
  readonly ok: boolean;
  readonly checkedAt: string;
  readonly checks: readonly WorkerPreflightCheck[];
};

export type WorkerPreflightDependencies = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: typeof fetch;
  readonly freeBytes?: (path: string) => number;
  readonly queryDatabase?: () => Promise<{
    readonly frontierTasks?: string | null;
    readonly researchRuns?: string | null;
    readonly frontier_tasks?: string | null;
    readonly research_runs?: string | null;
  }>;
  readonly now?: () => Date;
};

type LedgerProbe = {
  readonly frontierTasks?: string | null;
  readonly researchRuns?: string | null;
  readonly frontier_tasks?: string | null;
  readonly research_runs?: string | null;
};

const EXPECTED_PROFILE_ID = 'black-history';
const EXPECTED_PROFILE_VERSION = '1.0.0';
const EXPECTED_SCHEMA_VERSION = '1.0.0';

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/+$/u, '');
}

async function endpointCheck(
  fetcher: typeof fetch,
  name: string,
  urls: readonly string[],
): Promise<WorkerPreflightCheck> {
  for (const url of urls) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) return { name, ok: true, detail: 'reachable' };
    } catch {
      // Try the next health endpoint without leaking URLs or response bodies.
    }
  }
  return { name, ok: false, detail: 'unreachable' };
}

function exactEnvironmentCheck(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  key: string,
  expected: string,
): WorkerPreflightCheck {
  const value = environment[key]?.trim();
  return value === expected
    ? { name, ok: true, detail: expected }
    : { name, ok: false, detail: `${key} must equal ${expected}` };
}

function availableBytes(path: string): number {
  const stat = statfsSync(path);
  return Number(stat.bavail) * Number(stat.bsize);
}

export async function runWorkerPreflight(
  dependencies: WorkerPreflightDependencies = {},
): Promise<WorkerPreflightReport> {
  const environment = dependencies.environment ?? process.env;
  const fetcher = dependencies.fetch ?? fetch;
  const checks: WorkerPreflightCheck[] = [];
  const databaseUrl = environment.DATABASE_URL?.trim() || environment.APP_DATABASE_URL?.trim();
  checks.push({
    name: 'postgres-credentials',
    ok: Boolean(databaseUrl),
    detail: databaseUrl ? 'configured' : 'DATABASE_URL or APP_DATABASE_URL is required',
  });
  checks.push(
    exactEnvironmentCheck(environment, 'profile-id', 'RESEARCH_PROFILE_ID', EXPECTED_PROFILE_ID),
    exactEnvironmentCheck(
      environment,
      'profile-version',
      'RESEARCH_PROFILE_VERSION',
      EXPECTED_PROFILE_VERSION,
    ),
    exactEnvironmentCheck(
      environment,
      'schema-version',
      'RESEARCH_SCHEMA_VERSION',
      EXPECTED_SCHEMA_VERSION,
    ),
  );

  if (databaseUrl) {
    try {
      const row: LedgerProbe | undefined = dependencies.queryDatabase
        ? await dependencies.queryDatabase()
        : (
            await getOpsPostgresPool(environment).query<{
              frontier_tasks: string | null;
              research_runs: string | null;
            }>(
              `SELECT
                 to_regclass('bb_research.frontier_tasks')::text AS frontier_tasks,
                 to_regclass('bb_research.runs')::text AS research_runs`,
            )
          ).rows[0];
      const frontierTasks = row?.frontierTasks ?? row?.frontier_tasks;
      const researchRuns = row?.researchRuns ?? row?.research_runs;
      checks.push({
        name: 'postgres-ledger',
        ok: Boolean(frontierTasks) && Boolean(researchRuns),
        detail:
          Boolean(frontierTasks) && Boolean(researchRuns)
            ? 'research ledger available'
            : 'research ledger migration is missing',
      });
    } catch {
      checks.push({
        name: 'postgres-ledger',
        ok: false,
        detail: 'connection or schema check failed',
      });
    }
  }

  const root = environment.BLACKSTORY_ROOT?.trim() || process.cwd();
  const minimumBytes = Number(environment.RESEARCH_MIN_FREE_BYTES ?? 5 * 1024 ** 3);
  try {
    const freeBytes = (dependencies.freeBytes ?? availableBytes)(root);
    checks.push({
      name: 'disk-space',
      ok: Number.isFinite(minimumBytes) && freeBytes >= minimumBytes,
      detail: `${Math.floor(freeBytes / 1024 ** 3)} GiB free`,
    });
  } catch {
    checks.push({ name: 'disk-space', ok: false, detail: 'unable to inspect filesystem' });
  }

  const searxng = normalizedBaseUrl(
    environment.SEARXNG_BASE_URL?.trim() || 'http://127.0.0.1:8888',
  );
  checks.push(await endpointCheck(fetcher, 'searxng', [`${searxng}/healthz`, `${searxng}/`]));

  const ollamaRaw = environment.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434/v1';
  const ollama = normalizedBaseUrl(ollamaRaw.replace(/\/v1$/u, ''));
  const ollamaCheck = await endpointCheck(fetcher, 'ollama', [`${ollama}/api/tags`]);
  checks.push(ollamaCheck);
  if (ollamaCheck.ok) {
    try {
      const response = await fetcher(`${ollama}/api/tags`, { signal: AbortSignal.timeout(5_000) });
      const payload = (await response.json()) as {
        models?: readonly { name?: string; model?: string }[];
      };
      const expected = environment.OLLAMA_MODEL?.trim() || 'qwen3:8b';
      const present = (payload.models ?? []).some(
        (model) => model.name === expected || model.model === expected,
      );
      checks.push({
        name: 'ollama-model',
        ok: present,
        detail: present ? expected : `${expected} is not installed`,
      });
    } catch {
      checks.push({ name: 'ollama-model', ok: false, detail: 'model inventory failed' });
    }
  }

  const provider = environment.EDITORIAL_LLM_PROVIDER?.trim() || 'hybrid';
  if (provider === 'openrouter' || provider === 'hybrid') {
    checks.push({
      name: 'openrouter-credentials',
      ok: Boolean(environment.OPENROUTER_API_KEY?.trim()),
      detail: environment.OPENROUTER_API_KEY?.trim()
        ? 'configured'
        : 'OPENROUTER_API_KEY is required',
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    checks: Object.freeze(checks),
  };
}

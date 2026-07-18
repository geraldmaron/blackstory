
/**
 * PostgreSQL integration harness for disposable local/CI databases.
 * Skips when Docker/Postgres is unavailable unless CI_REQUIRE_POSTGRES=1.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { assertTestsCannotAccessProduction } from '../guards/production.js';

export const REQUIRE_POSTGRES_ENV = 'CI_REQUIRE_POSTGRES';

export type PostgresHarness = {
  readonly available: boolean;
  readonly reason?: string;
  readonly connectionString?: string;
  readonly schemaName?: string;
  readonly runSql: (sql: string) => { ok: boolean; stdout: string; stderr: string };
  readonly dispose: () => void;
};

function defaultConnectionString(): string {
  return (
    process.env.BLAP_TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook'
  );
}

function psqlAvailable(): boolean {
  const result = spawnSync('psql', ['--version'], { encoding: 'utf8' });
  return result.status === 0;
}

function canConnect(connectionString: string): boolean {
  const result = spawnSync('psql', [connectionString, '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT 1'], {
    encoding: 'utf8',
    env: process.env,
  });
  return result.status === 0;
}


/**
 * Opens a disposable schema on a local/CI Postgres instance.
 * Callers must invoke dispose to drop the schema.
 */
export function createPostgresHarness(
  connectionString: string = defaultConnectionString(),
): PostgresHarness {
  assertTestsCannotAccessProduction({
    ...process.env,
    DATABASE_URL: connectionString,
  });

  if (!psqlAvailable()) {
    return unavailable('psql client is not installed');
  }
  if (!canConnect(connectionString)) {
    return unavailable('PostgreSQL is unreachable (start with `pnpm db:up` or provide CI service)');
  }

  const schemaName = `bb_test_${randomBytes(4).toString('hex')}`;
  const create = spawnSync(
    'psql',
    [connectionString, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE SCHEMA ${schemaName}`],
    { encoding: 'utf8', env: process.env },
  );
  if (create.status !== 0) {
    return unavailable(`failed to create disposable schema: ${create.stderr}`);
  }

  const runSql = (sql: string) => {
    const result = spawnSync(
      'psql',
      [connectionString, '-v', 'ON_ERROR_STOP=1', '-c', `SET search_path TO ${schemaName}; ${sql}`],
      { encoding: 'utf8', env: process.env },
    );
    return {
      ok: result.status === 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };

  return {
    available: true,
    connectionString,
    schemaName,
    runSql,
    dispose: () => {
      spawnSync(
        'psql',
        [
          connectionString,
          '-v',
          'ON_ERROR_STOP=1',
          '-c',
          `DROP SCHEMA IF EXISTS ${schemaName} CASCADE`,
        ],
        { encoding: 'utf8', env: process.env },
      );
    },
  };
}

function unavailable(reason: string): PostgresHarness {
  const required = process.env[REQUIRE_POSTGRES_ENV] === '1';
  if (required) {
    throw new Error(
      `PostgreSQL harness required (${REQUIRE_POSTGRES_ENV}=1) but unavailable: ${reason}`,
    );
  }
  return {
    available: false,
    reason,
    runSql: () => ({ ok: false, stdout: '', stderr: reason }),
    dispose: () => undefined,
  };
}

export function postgresHarnessGate(harness: PostgresHarness): { skip: boolean } {
  return { skip: !harness.available };
}

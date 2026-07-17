/**
 * Integration checks for Postgres role isolation when a disposable DB is available.
 * Skips locally without Docker/psql; CI Integration Postgres sets CI_REQUIRE_POSTGRES=1.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const APPLY = path.join(ROOT, 'infra/database/scripts/apply-init.sh');
const VERIFY = path.join(ROOT, 'infra/database/scripts/verify-isolation.sh');
const REQUIRE = process.env.CI_REQUIRE_POSTGRES === '1';

const connectionString =
  process.env.BLACK_BOOK_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook';

function postgresReachable(): boolean {
  const version = spawnSync('psql', ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) {
    return false;
  }
  const ping = spawnSync('psql', [connectionString, '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT 1'], {
    encoding: 'utf8',
    env: process.env,
  });
  return ping.status === 0;
}

const available = postgresReachable();

test(
  'applies foundation SQL and passes isolation checks when Postgres is available',
  { skip: !available && !REQUIRE },
  () => {
    if (!available) {
      throw new Error('CI_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable');
    }
    const apply = spawnSync('bash', [APPLY], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: connectionString },
    });
    assert.equal(apply.status, 0, apply.stderr || apply.stdout);
    const verify = spawnSync('bash', [VERIFY], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: connectionString },
    });
    assert.equal(verify.status, 0, verify.stderr || verify.stdout);
  },
);

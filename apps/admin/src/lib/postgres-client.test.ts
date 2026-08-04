/**
 * Proves the pool fails fast instead of hanging a server-rendered page (repo-7pqy).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POSTGRES_TIMEOUT_DEFAULTS,
  isPostgresUnavailableError,
  readPostgresOrDegrade,
  resolvePostgresPoolSettings,
} from './postgres-client';

test('pool settings carry connect, statement, and query timeouts by default', () => {
  const settings = resolvePostgresPoolSettings({});

  assert.equal(settings.connectionTimeoutMillis, POSTGRES_TIMEOUT_DEFAULTS.connectionTimeoutMillis);
  assert.equal(settings.statement_timeout, POSTGRES_TIMEOUT_DEFAULTS.statementTimeoutMillis);
  assert.ok(settings.connectionTimeoutMillis > 0 && settings.connectionTimeoutMillis <= 10_000);
  assert.ok(settings.statement_timeout <= 30_000, 'a page must not block on Postgres for 30s+');
});

test('query timeout always sits above statement timeout so Postgres cancels first', () => {
  const settings = resolvePostgresPoolSettings({
    DATABASE_STATEMENT_TIMEOUT_MS: '20000',
    DATABASE_QUERY_TIMEOUT_MS: '1000',
  });

  assert.equal(settings.statement_timeout, 20_000);
  assert.ok(settings.query_timeout > settings.statement_timeout);
});

test('invalid or empty overrides fall back to the defaults rather than disabling timeouts', () => {
  for (const raw of ['', '   ', '0', '-1', 'soon', '1.5']) {
    const settings = resolvePostgresPoolSettings({
      DATABASE_CONNECT_TIMEOUT_MS: raw,
      DATABASE_POOL_MAX: raw,
    });
    assert.equal(
      settings.connectionTimeoutMillis,
      POSTGRES_TIMEOUT_DEFAULTS.connectionTimeoutMillis,
      `"${raw}" must not disable the connect timeout`,
    );
    assert.equal(settings.max, POSTGRES_TIMEOUT_DEFAULTS.max);
  }
});

test('unreachable-database failures are recognized; query errors are not', () => {
  assert.equal(isPostgresUnavailableError(new Error('Connection terminated unexpectedly')), true);
  assert.equal(isPostgresUnavailableError(Object.assign(new Error('x'), { code: '57014' })), true);
  assert.equal(
    isPostgresUnavailableError(Object.assign(new Error('connect'), { code: 'ENOTFOUND' })),
    true,
  );
  assert.equal(isPostgresUnavailableError(new Error('Query read timeout')), true);

  assert.equal(
    isPostgresUnavailableError(
      Object.assign(new Error('column "nope" does not exist'), { code: '42703' }),
    ),
    false,
  );
  assert.equal(isPostgresUnavailableError(null), false);
});

test('a degraded read returns a value instead of hanging the render', async () => {
  const ok = await readPostgresOrDegrade(async () => 42, 'facets');
  assert.deepEqual(ok, { status: 'ok', value: 42 });

  const degraded = await readPostgresOrDegrade(async () => {
    throw new Error('Connection terminated unexpectedly');
  }, 'facets');
  assert.equal(degraded.status, 'degraded');
});

test('a genuine query bug still throws — degradation must not hide broken SQL', async () => {
  await assert.rejects(
    readPostgresOrDegrade(async () => {
      throw Object.assign(new Error('syntax error at or near "SELCT"'), { code: '42601' });
    }, 'entities'),
    /syntax error/,
  );
});

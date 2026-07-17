/**
 * Unit tests for role matrix, config guards, and pool exhaustion (BB-012).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertNoBrowserDatabaseCredentials,
  assertOperationAuthorized,
  assertRoleIsolationInvariants,
  assertWriteAllowed,
  buildSessionSetupSql,
  ConnectionPool,
  listSqlConnectOperations,
  parseDatabaseConfig,
  PoolExhaustedError,
  roleMayAccess,
  simulateConnectionExhaustion,
  SQL_CONNECT_SDK_STATUS,
} from './index.ts';

test('role isolation invariants hold', () => {
  assertRoleIsolationInvariants();
  assert.equal(roleMayAccess('role_public_read', 'bb_public', 'read'), true);
  assert.equal(roleMayAccess('role_public_read', 'bb_public', 'write'), false);
  assert.equal(roleMayAccess('role_research', 'bb_public', 'write'), false);
  assert.equal(roleMayAccess('role_publication', 'bb_evidence', 'write'), false);
});

test('rejects public Next.js database env keys', () => {
  assert.throws(() =>
    assertNoBrowserDatabaseCredentials({
      NEXT_PUBLIC_DATABASE_URL: 'postgresql://x',
    }),
  );
});

test('parseDatabaseConfig requires server role and connection target', () => {
  const config = parseDatabaseConfig({
    BLACK_BOOK_DB_ROLE: 'role_public_read',
    DATABASE_URL: 'postgresql://role_public_read:local-public-read@127.0.0.1:5432/blackbook',
  });
  assert.equal(config.role, 'role_public_read');
  assert.equal(config.maxPoolSize, 10);
});

test('session setup SQL pins role and search_path', () => {
  const sql = buildSessionSetupSql({ role: 'role_public_read' });
  assert.deepEqual(sql, ['SET ROLE role_public_read', 'SET search_path TO bb_public']);
});

test('assertWriteAllowed blocks research → public', () => {
  assert.throws(() => assertWriteAllowed('role_research', 'bb_public'));
});

test('every SQL Connect operation is NO_ACCESS and browser-denied', () => {
  const operations = listSqlConnectOperations();
  assert.ok(operations.length >= 6);
  for (const operation of operations) {
    assert.equal(operation.authLevel, 'NO_ACCESS');
    assert.equal(operation.browserAllowed, false);
    assert.ok(operation.allowedSurfaces.length > 0);
  }
});

test('assertOperationAuthorized enforces surface and role', () => {
  assertOperationAuthorized({
    connectorId: 'public-read',
    operationName: 'ListReleasedEntities',
    surface: 'apps/api-public',
    databaseRole: 'role_public_read',
  });
  assert.throws(() =>
    assertOperationAuthorized({
      connectorId: 'public-read',
      operationName: 'ListReleasedEntities',
      surface: 'apps/web',
      databaseRole: 'role_public_read',
    }),
  );
  assert.throws(() =>
    assertOperationAuthorized({
      connectorId: 'publication',
      operationName: 'ActivateRelease',
      surface: 'workers/research',
      databaseRole: 'role_research',
    }),
  );
});

test('connection pool fails closed on exhaustion', async () => {
  let created = 0;
  const pool = new ConnectionPool({
    max: 2,
    acquireTimeoutMs: 50,
    createClient: async () => {
      const id = `c-${created++}`;
      return { id, close: () => undefined };
    },
    sleep: async () => undefined,
  });
  const a = await pool.acquire();
  const b = await pool.acquire();
  await assert.rejects(() => pool.acquire(), PoolExhaustedError);
  a.release();
  const c = await pool.acquire();
  assert.equal(c.id, a.id);
  b.release();
  c.release();
  await pool.drain();
});

test('simulateConnectionExhaustion reports overflow', async () => {
  const result = await simulateConnectionExhaustion({
    max: 3,
    acquireTimeoutMs: 20,
    concurrent: 8,
  });
  assert.equal(result.acquired, 3);
  assert.equal(result.exhausted, 5);
});

test('generated SDK status documents compile path', () => {
  assert.equal(SQL_CONNECT_SDK_STATUS.generated, true);
  assert.equal(SQL_CONNECT_SDK_STATUS.cloudLinked, false);
  assert.match(SQL_CONNECT_SDK_STATUS.compileCommand, /dataconnect:compile/);
});

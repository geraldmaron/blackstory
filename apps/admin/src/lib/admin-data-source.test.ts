import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAdminDataSource } from './admin-data-source.js';

test('admin data source is always Postgres', () => {
  assert.equal(resolveAdminDataSource({}), 'postgres');
  assert.equal(resolveAdminDataSource({ ADMIN_DATA_SOURCE: ' POSTGRES ' }), 'postgres');
  assert.equal(resolveAdminDataSource({ DATABASE_URL: 'postgresql://localhost/test' }), 'postgres');
});

test('admin data source rejects legacy backend selection', () => {
  assert.throws(() => resolveAdminDataSource({ ADMIN_DATA_SOURCE: 'firestore' }), /unsupported/);
});

test('assertNoBrowserDatabaseCredentials rejects public database URLs', async () => {
  const { assertNoBrowserDatabaseCredentials } = await import('./postgres-client.js');
  assert.throws(
    () => assertNoBrowserDatabaseCredentials({ NEXT_PUBLIC_DATABASE_URL: 'postgres://x' }),
    /must never be set/,
  );
});

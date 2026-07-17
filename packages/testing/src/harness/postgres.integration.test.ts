
/**
 * PostgreSQL integration tests against a disposable schema.
 * Skips locally when Docker/Postgres is down; fails closed when CI_REQUIRE_POSTGRES=1.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createPostgresHarness, postgresHarnessGate } from './postgres.ts';

const harness = createPostgresHarness();

after(() => {
  harness.dispose();
});

test(
  'postgres disposable schema supports migration version table',
  postgresHarnessGate(harness),
  () => {
    assert.ok(harness.schemaName);
    const migrated = harness.runSql(`
    CREATE TABLE schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO schema_migrations(version) VALUES ('202607160001_init');
    SELECT version FROM schema_migrations;
  `);
    assert.equal(migrated.ok, true, migrated.stderr);
    assert.match(migrated.stdout, /202607160001_init/);
  },
);

test('postgres harness rejects production connection strings before connecting', () => {
  assert.throws(
    () => createPostgresHarness('postgresql://user:pass@db.example.supabase.co:5432/postgres'),
    /production services|not a local/,
  );
});

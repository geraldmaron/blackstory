
/**
 * Migration-layer harness test: applies a representative schema_migrations DDL.
 * Uses the Postgres disposable harness; skips unless Postgres is available.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createPostgresHarness, postgresHarnessGate } from '../harness/postgres.ts';

const harness = createPostgresHarness();

after(() => {
  harness.dispose();
});

test(
  'migration harness can apply and record a forward-only migration',
  postgresHarnessGate(harness),
  () => {
    const result = harness.runSql(`
      CREATE TABLE schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE entities (
        id text PRIMARY KEY,
        kind text NOT NULL,
        name text NOT NULL
      );
      INSERT INTO schema_migrations(version, checksum)
      VALUES ('202607160001_entities', 'abc123');
    `);
    assert.equal(result.ok, true, result.stderr);
    const probe = harness.runSql('SELECT count(*)::text AS n FROM schema_migrations');
    assert.equal(probe.ok, true, probe.stderr);
    assert.match(probe.stdout, /1/);
  },
);

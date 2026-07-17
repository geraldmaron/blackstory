/**
 * Static validation of infra/database SQL init scripts and role matrix.
 * Does not require a live Postgres; CI Integration Postgres runs runtime checks.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DATABASE_ROLES } from './roles.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const INIT_DIR = path.join(ROOT, 'infra/database/init');

function readInit(name: string): string {
  return readFileSync(path.join(INIT_DIR, name), 'utf8');
}

test('init directory contains ordered foundation scripts', () => {
  const names = readdirSync(INIT_DIR);
  for (const required of [
    '00-extensions.sql',
    '10-schemas.sql',
    '20-roles.sh',
    '25-boundary-stubs.sql',
    '30-grants.sql',
    '40-timeouts-and-limits.sql',
    '90-verify.sql',
    '91-isolation-checks.sql',
  ]) {
    assert.ok(names.includes(required), `missing ${required}`);
  }
});

test('extensions SQL enables PostGIS and FTS helpers', () => {
  const sql = readInit('00-extensions.sql');
  assert.match(sql, /postgis/);
  assert.match(sql, /pg_trgm/);
  assert.match(sql, /pgcrypto/);
});

test('grants SQL mentions every database role', () => {
  const sql = readInit('30-grants.sql');
  for (const role of DATABASE_ROLES) {
    assert.match(sql, new RegExp(role));
  }
  assert.match(sql, /REVOKE ALL ON SCHEMA bb_public FROM role_research/);
  assert.match(
    sql,
    /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA bb_evidence FROM role_publication/,
  );
});

test('timeouts SQL sets statement, lock, and idle_in_transaction budgets', () => {
  const sql = readInit('40-timeouts-and-limits.sql');
  assert.match(sql, /statement_timeout/);
  assert.match(sql, /lock_timeout/);
  assert.match(sql, /idle_in_transaction_session_timeout/);
  assert.match(sql, /CONNECTION LIMIT/);
});

test('SQL Connect templates require NO_ACCESS and admin SDK only', () => {
  const connectorsRoot = path.join(ROOT, 'infra/database/sql-connect/dataconnect/connectors');
  const connectors = readdirSync(connectorsRoot);
  assert.deepEqual(connectors.sort(), ['admin', 'public-read', 'publication', 'submissions']);
  for (const connector of connectors) {
    const yaml = readFileSync(path.join(connectorsRoot, connector, 'connector.yaml'), 'utf8');
    assert.match(yaml, /adminNodeSdk/);
    assert.doesNotMatch(yaml, /^\s*javascriptSdk:/m);
    const gqlFiles = readdirSync(path.join(connectorsRoot, connector)).filter((name) =>
      name.endsWith('.gql'),
    );
    for (const gqlFile of gqlFiles) {
      const gql = readFileSync(path.join(connectorsRoot, connector, gqlFile), 'utf8');
      assert.match(gql, /@auth\(level:\s*NO_ACCESS\)/);
      assert.doesNotMatch(gql, /@auth\(level:\s*PUBLIC/);
    }
  }
});

test('no production secrets hardcoded in init role script', () => {
  const script = readInit('20-roles.sh');
  assert.match(script, /local-public-read/);
  assert.doesNotMatch(script, /op:\/\//);
  assert.doesNotMatch(script, /AIza/);
});

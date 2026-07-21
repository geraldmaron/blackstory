/**
 * Unit tests for Postgres path routing, SSL URL normalize, and idempotency doc-id decoding
 * (no live DB).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeIdempotencyDocId } from './path-write.js';
import { resolveOpsDataSource } from './data-source.js';
import { normalizePgConnectionString } from './pool.js';

describe('resolveOpsDataSource', () => {
  it('returns postgres when ADMIN_DATA_SOURCE=postgres', () => {
    assert.equal(resolveOpsDataSource({ ADMIN_DATA_SOURCE: 'postgres' }), 'postgres');
  });

  it('rejects non-postgres explicit sources', () => {
    assert.throws(
      () => resolveOpsDataSource({ ADMIN_DATA_SOURCE: 'firestore', DATABASE_URL: 'x' }),
      /Unsupported ops data source firestore/,
    );
    assert.throws(
      () => resolveOpsDataSource({ OPS_DATA_SOURCE: 'firestore', DATABASE_URL: 'x' }),
      /Unsupported ops data source firestore/,
    );
  });

  it('returns postgres when DATABASE_URL is set', () => {
    assert.equal(resolveOpsDataSource({ DATABASE_URL: 'postgresql://localhost/db' }), 'postgres');
  });

  it('defaults to postgres without URL (SoR cutover)', () => {
    assert.equal(resolveOpsDataSource({}), 'postgres');
  });
});

describe('normalizePgConnectionString', () => {
  it('leaves local URLs unchanged', () => {
    const raw = 'postgresql://localhost:5432/blackstory';
    const result = normalizePgConnectionString(raw, {});
    assert.equal(result.connectionString, raw);
    assert.equal(result.ssl, undefined);
  });

  it('adds uselibpqcompat for supabase hosts with sslmode=require', () => {
    const raw = 'postgresql://user:pass@db.abc.supabase.co:5432/postgres?sslmode=require';
    const result = normalizePgConnectionString(raw, {});
    const url = new URL(result.connectionString);
    assert.equal(url.searchParams.get('uselibpqcompat'), 'true');
    assert.equal(url.searchParams.get('sslmode'), 'require');
    assert.deepEqual(result.ssl, { rejectUnauthorized: false });
  });

  it('enables ssl when DATABASE_SSL=1 even without supabase host', () => {
    const raw = 'postgresql://user:pass@db.example.com:5432/postgres?sslmode=require';
    const result = normalizePgConnectionString(raw, { DATABASE_SSL: '1' });
    assert.equal(new URL(result.connectionString).searchParams.get('uselibpqcompat'), 'true');
    assert.deepEqual(result.ssl, { rejectUnauthorized: false });
  });
});

describe('decodeIdempotencyDocId', () => {
  it('round-trips utf8 keys via base64url', () => {
    const key = 'research-case:abc:assign:2026-01-01T00:00:00.000Z:uuid';
    const docId = Buffer.from(key, 'utf8').toString('base64url');
    assert.equal(decodeIdempotencyDocId(docId), key);
  });
});

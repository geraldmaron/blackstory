import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SafeFetchResult } from '@repo/security/url-safety';
import { runCaptureBackfill, type CaptureDb } from './capture-backfill.js';
import { createMetadataOnlyStorage, type CaptureDeps } from './source-capture.js';

/** Fake DB: returns fixed rows per surface query and records writes. */
function fakeDb(): CaptureDb & { writes: { sql: string; params?: readonly unknown[] }[] } {
  const writes: { sql: string; params?: readonly unknown[] }[] = [];
  return {
    writes,
    async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      if (sql.includes('theme_impact_packets')) {
        return { rows: [{ ref_id: 'obs1', url: 'https://census.gov/a' }] as unknown as T[] };
      }
      if (sql.includes('bb_reference.articles')) {
        return { rows: [{ ref_id: 'art1', url: 'https://census.gov/a' }] as unknown as T[] }; // dup URL
      }
      if (sql.includes('release_entities')) {
        return { rows: [{ ref_id: 'ent1', url: 'https://bls.gov/b' }] as unknown as T[] };
      }
      // an INSERT
      writes.push({ sql, params });
      if (sql.includes('source_captures')) return { rows: [{ id: 'x' }] as unknown as T[] };
      return { rows: [] as T[] };
    },
  };
}

const deps = (fetchUrl: CaptureDeps['fetchUrl']): CaptureDeps => ({
  fetchUrl,
  storage: createMetadataOnlyStorage(),
  parserVersion: 'capture-backfill-v1',
  newId: (prefix, seed) => `${prefix}_${seed.replace(/[^a-z0-9]/gi, '').slice(0, 10)}`,
  now: () => '2026-07-26T00:00:00.000Z',
});

const ok = (hash: string): SafeFetchResult => ({
  ok: true,
  finalUrl: 'https://x',
  redirectCount: 0,
  contentType: 'text/html',
  byteLength: 10,
  contentHash: hash,
  parser: { safe: true, indicators: [], extractedText: 'text' },
  quarantineState: 'validated',
  publicationAllowed: false,
});

test('dry-run inventories all surfaces, dedupes, and writes nothing', async () => {
  const db = fakeDb();
  const report = await runCaptureBackfill(db, { commit: false }, deps(async () => ok('a'.repeat(64))));
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.totalUnique, 2); // census.gov/a (packet+article dup) + bls.gov/b
  assert.equal(report.inventory.packet.cited, 1);
  assert.equal(report.inventory.article.unique, 0); // dup
  assert.equal(report.attempted, 0);
  assert.equal(db.writes.length, 0); // no writes on dry-run
});

test('commit fetches + persists, honors --max-captures budget', async () => {
  const db = fakeDb();
  let hashSeq = 0;
  const report = await runCaptureBackfill(
    db,
    { commit: true, maxCaptures: 1 },
    deps(async () => ok(String(hashSeq++).padStart(64, '0'))),
  );
  assert.equal(report.mode, 'commit');
  assert.equal(report.planned, 1);
  assert.equal(report.attempted, 1);
  assert.equal(report.captured, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.captureRate, 1);
  // one capture insert + one retrieval_event insert
  assert.equal(db.writes.filter((w) => w.sql.includes('source_captures')).length, 1);
  assert.equal(db.writes.filter((w) => w.sql.includes('retrieval_events')).length, 1);
});

test('commit records failures as retrieval events without a capture row', async () => {
  const db = fakeDb();
  const report = await runCaptureBackfill(
    db,
    { commit: true },
    deps(async () => ({ ok: false, reason: 'transport_failed', quarantineState: 'rejected', publicationAllowed: false }) as SafeFetchResult),
  );
  assert.equal(report.captured, 0);
  assert.equal(report.failed, 2); // both unique URLs fail
  assert.equal(db.writes.filter((w) => w.sql.includes('source_captures')).length, 0);
  assert.equal(db.writes.filter((w) => w.sql.includes('retrieval_events')).length, 2);
});

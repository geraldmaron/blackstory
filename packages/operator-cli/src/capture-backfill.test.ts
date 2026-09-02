import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SafeFetchResult } from '@repo/security/url-safety';
import {
  runCaptureBackfill,
  selectUrlsForEntityBatch,
  type CaptureDb,
} from './capture-backfill.js';
import { createMetadataOnlyStorage, type CaptureDeps } from './source-capture.js';
import type { WaybackAnchor } from './wayback-anchor.js';

/** Fake DB: returns fixed rows per surface query and records writes. */
function fakeDb(
  entityRows: readonly { ref_id: string; url: string }[] = [
    { ref_id: 'ent1', url: 'https://bls.gov/b' },
  ],
): CaptureDb & { writes: { sql: string; params?: readonly unknown[] }[] } {
  const writes: { sql: string; params?: readonly unknown[] }[] = [];
  return {
    writes,
    async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      if (sql.includes('theme_impact_packets')) {
        return { rows: [{ ref_id: 'obs1', url: 'https://census.gov/a' }] as unknown as T[] };
      }
      if (sql.includes('bb_reference.articles')) {
        return { rows: [{ ref_id: 'art1', url: 'https://census.gov/a' }] as unknown as T[] };
      }
      if (sql.includes('release_entities')) {
        return { rows: entityRows as unknown as T[] };
      }
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
  const report = await runCaptureBackfill(
    db,
    { commit: false },
    deps(async () => ok('a'.repeat(64))),
  );
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.totalUnique, 2); // census.gov/a (packet+article dup) + bls.gov/b
  assert.equal(report.inventory.packet.cited, 1);
  assert.equal(report.inventory.article.unique, 0); // dup
  assert.equal(report.attempted, 0);
  assert.equal(db.writes.length, 0); // no writes on dry-run
  assert.equal(report.wayback.status, 'off');
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
    deps(
      async () =>
        ({
          ok: false,
          reason: 'transport_failed',
          quarantineState: 'rejected',
          publicationAllowed: false,
        }) as SafeFetchResult,
    ),
  );
  assert.equal(report.captured, 0);
  assert.equal(report.failed, 2); // both unique URLs fail
  assert.equal(db.writes.filter((w) => w.sql.includes('source_captures')).length, 0);
  assert.equal(db.writes.filter((w) => w.sql.includes('retrieval_events')).length, 2);
});

test('--wayback without an anchor skips SPN and still captures locally', async () => {
  const db = fakeDb();
  const report = await runCaptureBackfill(
    db,
    { commit: true, wayback: true, maxCaptures: 1 },
    deps(async () => ok('b'.repeat(64))),
  );
  assert.equal(report.captured, 1);
  assert.equal(report.wayback.status, 'skipped_no_credentials');
  assert.equal(report.wayback.attempted, 0);
  const captureWrite = db.writes.find((w) => w.sql.includes('source_captures'));
  const stored = JSON.parse(String(captureWrite?.params?.[7] ?? '{}')) as {
    waybackStatus?: string;
  };
  assert.equal(stored.waybackStatus, undefined);
});

test('--wayback with an injected anchor stores the snapshot URL on storage_object', async () => {
  const db = fakeDb();
  const capturedUrls: string[] = [];
  const waybackAnchor: WaybackAnchor = {
    async captureUrl(url) {
      capturedUrls.push(url);
      return {
        status: 'anchored',
        waybackCaptureUrl: `https://web.archive.org/web/20260901150000/${url}`,
        waybackCapturedAt: '2026-09-01T15:00:00.000Z',
      };
    },
  };
  const report = await runCaptureBackfill(
    db,
    { commit: true, wayback: true, maxCaptures: 1 },
    { ...deps(async () => ok('c'.repeat(64))), waybackAnchor },
  );
  assert.equal(report.wayback.status, 'ran');
  assert.equal(report.wayback.anchored, 1);
  assert.equal(report.wayback.failed, 0);
  assert.equal(capturedUrls.length, 1);
  const captureWrite = db.writes.find((w) => w.sql.includes('source_captures'));
  const stored = JSON.parse(String(captureWrite?.params?.[7] ?? '{}')) as {
    waybackCaptureUrl?: string;
    waybackStatus?: string;
  };
  assert.equal(stored.waybackStatus, 'anchored');
  assert.match(stored.waybackCaptureUrl ?? '', /^https:\/\/web\.archive\.org\/web\//);
});

test('--wayback SPN failure still persists the local capture', async () => {
  const db = fakeDb();
  const waybackAnchor: WaybackAnchor = {
    async captureUrl() {
      return { status: 'failed', reason: 'spn_error' };
    },
  };
  const report = await runCaptureBackfill(
    db,
    { commit: true, wayback: true, maxCaptures: 1 },
    { ...deps(async () => ok('d'.repeat(64))), waybackAnchor },
  );
  assert.equal(report.captured, 1);
  assert.equal(report.wayback.failed, 1);
  assert.equal(report.wayback.anchored, 0);
  const captureWrite = db.writes.find((w) => w.sql.includes('source_captures'));
  const stored = JSON.parse(String(captureWrite?.params?.[7] ?? '{}')) as {
    waybackStatus?: string;
    waybackReason?: string;
  };
  assert.equal(stored.waybackStatus, 'failed');
  assert.equal(stored.waybackReason, 'spn_error');
});

test('dry-run --wayback with credentials plans SPN and writes nothing', async () => {
  const db = fakeDb();
  let called = false;
  const waybackAnchor: WaybackAnchor = {
    async captureUrl() {
      called = true;
      return { status: 'failed', reason: 'should_not_run' };
    },
  };
  const report = await runCaptureBackfill(
    db,
    { commit: false, wayback: true },
    { ...deps(async () => ok('e'.repeat(64))), waybackAnchor },
  );
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.wayback.status, 'planned');
  assert.equal(called, false);
  assert.equal(db.writes.length, 0);
});

test('failed local fetches do not call SPN', async () => {
  const db = fakeDb();
  let called = false;
  const waybackAnchor: WaybackAnchor = {
    async captureUrl() {
      called = true;
      return {
        status: 'anchored',
        waybackCaptureUrl: 'https://web.archive.org/web/1/x',
        waybackCapturedAt: 't',
      };
    },
  };
  const report = await runCaptureBackfill(
    db,
    { commit: true, wayback: true },
    {
      ...deps(
        async () =>
          ({
            ok: false,
            reason: 'transport_failed',
            quarantineState: 'rejected',
            publicationAllowed: false,
          }) as SafeFetchResult,
      ),
      waybackAnchor,
    },
  );
  assert.equal(report.failed, 2);
  assert.equal(called, false);
  assert.equal(report.wayback.attempted, 0);
});

test('selectUrlsForEntityBatch keeps every URL for the first N entities', () => {
  const batch = selectUrlsForEntityBatch(
    [
      { url: 'https://a.gov/1', surface: 'entity', refId: 'ent1' },
      { url: 'https://a.gov/2', surface: 'entity', refId: 'ent1' },
      { url: 'https://b.gov/1', surface: 'entity', refId: 'ent2' },
      { url: 'https://c.gov/1', surface: 'entity', refId: 'ent3' },
      { url: 'https://pkt.gov/1', surface: 'packet', refId: 'obs' },
    ],
    2,
  );
  assert.equal(batch.entityCount, 2);
  assert.deepEqual(
    batch.urls.map((row) => row.refId),
    ['ent1', 'ent1', 'ent2'],
  );
});

test('--max-entities captures only the first N entities and skips packets', async () => {
  const db = fakeDb([
    { ref_id: 'ent1', url: 'https://a.gov/1' },
    { ref_id: 'ent1', url: 'https://a.gov/2' },
    { ref_id: 'ent2', url: 'https://b.gov/1' },
    { ref_id: 'ent3', url: 'https://c.gov/1' },
  ]);
  let hashSeq = 0;
  const fetched: string[] = [];
  const report = await runCaptureBackfill(
    db,
    { commit: true, maxEntities: 2 },
    deps(async (url) => {
      fetched.push(url);
      return ok(String(hashSeq++).padStart(64, '0'));
    }),
  );
  assert.equal(report.plannedEntities, 2);
  assert.equal(report.planned, 3);
  assert.equal(report.attempted, 3);
  assert.equal(report.captured, 3);
  assert.deepEqual(fetched, ['https://a.gov/1', 'https://a.gov/2', 'https://b.gov/1']);
  assert.equal(report.perSurface.packet.attempted, 0);
});

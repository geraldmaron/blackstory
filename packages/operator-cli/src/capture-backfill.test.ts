import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SafeFetchResult } from '@repo/security/url-safety';
import {
  DEFAULT_COMMIT_CAPTURE_LIMIT,
  captureInventoryFingerprint,
  runCaptureBackfill,
  selectUrlsForEntityBatch,
  type CaptureDb,
} from './capture-backfill.js';
import { createMetadataOnlyStorage, type CaptureDeps } from './source-capture.js';
import type { WaybackAnchor } from './wayback-anchor.js';
import type { WaybackLookup } from './wayback-lookup.js';

/** Fake DB: returns fixed rows per surface query and records writes. */
function fakeDb(
  entityRows: readonly { ref_id: string; url: string }[] = [
    { ref_id: 'ent1', url: 'https://bls.gov/b' },
  ],
): CaptureDb & { writes: { sql: string; params?: readonly unknown[] }[] } {
  const writes: { sql: string; params?: readonly unknown[] }[] = [];
  return {
    writes,
    async connect() {
      return { query: this.query.bind(this), release() {} };
    },
    async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      if (sql.includes('theme_impact_packets')) {
        return { rows: [{ ref_id: 'obs1', url: 'https://census.gov/a' }] as unknown as T[] };
      }
      if (sql.includes('reference.articles')) {
        return { rows: [{ ref_id: 'art1', url: 'https://census.gov/a' }] as unknown as T[] };
      }
      if (sql.includes('release_entities')) {
        return { rows: entityRows as unknown as T[] };
      }
      writes.push({ sql, params });
      if (sql.includes('INSERT INTO evidence.capture_origins'))
        return { rows: [{ source_item_id: 'fixture-item' }] as unknown as T[] };
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
  assert.equal(report.inventory.article.unique, 1); // dup
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

test('bounded batches resume in stable URL order and reject a changed inventory', async () => {
  const firstFetched: string[] = [];
  const first = await runCaptureBackfill(
    fakeDb(),
    { commit: true, maxCaptures: 1 },
    deps(async (url) => {
      firstFetched.push(url);
      return ok('1'.repeat(64));
    }),
  );
  assert.deepEqual(firstFetched, ['https://bls.gov/b']);
  assert.equal(first.totalUnique, 2);
  assert.equal(first.remaining, 1);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextCursor, 'https://bls.gov/b');
  assert.equal(first.inventoryFingerprint.length, 64);

  const secondFetched: string[] = [];
  const second = await runCaptureBackfill(
    fakeDb(),
    {
      commit: true,
      maxCaptures: 1,
      afterUrl: first.nextCursor,
      inventoryFingerprint: first.inventoryFingerprint,
    },
    deps(async (url) => {
      secondFetched.push(url);
      return ok('2'.repeat(64));
    }),
  );
  assert.deepEqual(secondFetched, ['https://census.gov/a']);
  assert.equal(second.afterUrl, 'https://bls.gov/b');
  assert.equal(second.remaining, 0);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, undefined);

  await assert.rejects(
    runCaptureBackfill(
      fakeDb([{ ref_id: 'ent0', url: 'https://archives.gov/new' }]),
      {
        commit: true,
        maxCaptures: 1,
        afterUrl: first.nextCursor,
        inventoryFingerprint: first.inventoryFingerprint,
      },
      deps(async () => ok('3'.repeat(64))),
    ),
    /Capture inventory changed/,
  );
});

test('cursor resume requires the prior inventory fingerprint', async () => {
  await assert.rejects(
    runCaptureBackfill(
      fakeDb(),
      { commit: false, afterUrl: 'https://bls.gov/b' },
      deps(async () => ok('a'.repeat(64))),
    ),
    /afterUrl requires the prior inventoryFingerprint/,
  );
});

test('exact target captures one cited URL and rejects URLs outside the inventory', async () => {
  const fetched: string[] = [];
  const report = await runCaptureBackfill(
    fakeDb(),
    { commit: true, targetUrl: 'HTTPS://CENSUS.GOV/a#section' },
    deps(async (url) => {
      fetched.push(url);
      return ok('4'.repeat(64));
    }),
  );
  assert.deepEqual(fetched, ['https://census.gov/a']);
  assert.equal(report.targetUrl, 'https://census.gov/a');
  assert.equal(report.planned, 1);
  assert.equal(report.hasMore, false);

  await assert.rejects(
    runCaptureBackfill(
      fakeDb(),
      { commit: true, targetUrl: 'https://not-cited.example/record' },
      deps(async () => ok('5'.repeat(64))),
    ),
    /targetUrl is not present in the cited capture inventory/,
  );
  await assert.rejects(
    runCaptureBackfill(
      fakeDb(),
      { commit: true, targetUrl: 'https://census.gov/a', maxCaptures: 1 },
      deps(async () => ok('6'.repeat(64))),
    ),
    /cannot be combined/,
  );
});

test('commit defaults to a bounded batch while dry-run can inventory everything', async () => {
  const rows = Array.from({ length: DEFAULT_COMMIT_CAPTURE_LIMIT + 5 }, (_, index) => ({
    ref_id: `ent${index}`,
    url: `https://example.gov/${String(index).padStart(2, '0')}`,
  }));
  const committed = await runCaptureBackfill(
    fakeDb(rows),
    { commit: true },
    deps(async () => ok('7'.repeat(64))),
  );
  assert.equal(committed.planned, DEFAULT_COMMIT_CAPTURE_LIMIT);
  assert.equal(committed.hasMore, true);

  const dryRun = await runCaptureBackfill(
    fakeDb(rows),
    { commit: false },
    deps(async () => ok('8'.repeat(64))),
  );
  assert.equal(dryRun.planned, dryRun.totalUnique);
  assert.equal(dryRun.attempted, 0);
});

test('inventory fingerprints are stable across row order', () => {
  const urls = [
    { url: 'https://b.gov/', surface: 'entity' as const, refId: 'b' },
    { url: 'https://a.gov/', surface: 'article' as const, refId: 'a' },
  ];
  assert.equal(captureInventoryFingerprint(urls), captureInventoryFingerprint([...urls].reverse()));
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
  assert.deepEqual(report.failedUrls, ['https://bls.gov/b', 'https://census.gov/a']);
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
      { url: 'https://c.gov/1', surface: 'entity', refId: 'ent3' },
      { url: 'https://b.gov/1', surface: 'entity', refId: 'ent2' },
      { url: 'https://a.gov/1', surface: 'entity', refId: 'ent1' },
      { url: 'https://a.gov/2', surface: 'entity', refId: 'ent1' },
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

// ---- Wayback availability lookup fallback ----

const FAILED_FETCH = {
  ok: false,
  reason: 'transport_failed',
  quarantineState: 'rejected',
  publicationAllowed: false,
} as SafeFetchResult;

/** Records every URL it was asked about, so a test can prove a lookup did or did not happen. */
function fakeLookup(
  respond: (url: string) => Awaited<ReturnType<WaybackLookup['findSnapshot']>>,
): WaybackLookup & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async findSnapshot(url) {
      asked.push(url);
      return respond(url);
    },
  };
}

const foundSnapshot = (url: string) =>
  ({
    status: 'found',
    snapshot: {
      url: `https://web.archive.org/web/20260214093311/${url}`,
      timestamp: '20260214093311',
      httpStatus: '200',
    },
  }) as const;

/** The retrieval_events insert is the only write carrying a jsonb detail bag. */
function retrievalDetails(
  writes: readonly { sql: string; params?: readonly unknown[] }[],
): Record<string, unknown>[] {
  return writes
    .filter((write) => write.sql.includes('retrieval_events'))
    .map((write) => JSON.parse(String(write.params?.[5] ?? '{}')) as Record<string, unknown>);
}

test('an unreachable URL gets a lookup, and the existing snapshot lands on the failure event', async () => {
  const db = fakeDb();
  const lookup = fakeLookup(foundSnapshot);
  const report = await runCaptureBackfill(
    db,
    { commit: true, maxCaptures: 1 },
    { ...deps(async () => FAILED_FETCH), waybackLookup: lookup },
  );

  assert.equal(report.failed, 1);
  assert.equal(report.waybackLookup.available, true);
  assert.equal(report.waybackLookup.attempted, 1);
  assert.equal(report.waybackLookup.found, 1);
  assert.equal(report.waybackLookup.recoveredAfterFetchFailure, 1);
  assert.deepEqual(lookup.asked, ['https://bls.gov/b']);

  // No capture row exists for a failed fetch, so the pointer's only home is the event detail.
  assert.equal(db.writes.filter((w) => w.sql.includes('source_captures')).length, 0);
  const [detail] = retrievalDetails(db.writes);
  assert.equal(detail?.waybackLookupStatus, 'found');
  assert.equal(
    detail?.waybackAvailabilityUrl,
    'https://web.archive.org/web/20260214093311/https://bls.gov/b',
  );
  assert.equal(detail?.url, 'https://bls.gov/b', 'the original detail keys survive');
});

test('a lookup miss is recorded on the event and does not fail the lane', async () => {
  const db = fakeDb();
  const lookup = fakeLookup(() => ({ status: 'miss', reason: 'no_snapshot' }));
  const report = await runCaptureBackfill(
    db,
    { commit: true },
    { ...deps(async () => FAILED_FETCH), waybackLookup: lookup },
  );

  assert.equal(report.failed, 2, 'both URLs still fail locally, and the run still completes');
  assert.equal(report.waybackLookup.missed, 2);
  assert.equal(report.waybackLookup.found, 0);
  assert.equal(report.waybackLookup.recoveredAfterFetchFailure, 0);
  const details = retrievalDetails(db.writes);
  assert.equal(details.length, 2);
  assert.equal(details[0]?.waybackLookupStatus, 'miss');
  assert.equal(details[0]?.waybackLookupReason, 'no_snapshot');
  assert.equal(details[0]?.waybackAvailabilityUrl, undefined);
});

test('a lookup that throws would fail the lane, so the port must absorb it', async () => {
  // Guards the seam rather than the domain client: whatever findSnapshot does, capture-backfill
  // has no try/catch of its own, so a port that throws takes the whole backfill down.
  const db = fakeDb();
  const lookup: WaybackLookup = {
    async findSnapshot() {
      throw new Error('archive.org unreachable');
    },
  };
  await assert.rejects(
    () =>
      runCaptureBackfill(
        db,
        { commit: true },
        { ...deps(async () => FAILED_FETCH), waybackLookup: lookup },
      ),
    /archive.org unreachable/,
    'createWaybackLookup never throws; this documents why that matters',
  );
});

test('--wayback preserves the current revision even when availability finds an older snapshot', async () => {
  const db = fakeDb();
  const lookup = fakeLookup(foundSnapshot);
  let spnCalls = 0;
  const waybackAnchor: WaybackAnchor = {
    async captureUrl(_url, contentHashDigest) {
      spnCalls += 1;
      assert.equal(contentHashDigest, 'f'.repeat(64));
      return { status: 'failed', reason: 'should_not_run' };
    },
  };
  const report = await runCaptureBackfill(
    db,
    { commit: true, wayback: true, maxCaptures: 1 },
    { ...deps(async () => ok('f'.repeat(64))), waybackAnchor, waybackLookup: lookup },
  );

  assert.equal(spnCalls, 1, 'an older snapshot cannot satisfy the current revision');
  assert.equal(report.wayback.attempted, 1);
  assert.equal(report.captured, 1);

  // A local capture row exists here, so the pointer belongs on storage_object as well.
  const captureWrite = db.writes.find((w) => w.sql.includes('source_captures'));
  const stored = JSON.parse(String(captureWrite?.params?.[7] ?? '{}')) as Record<string, unknown>;
  assert.equal(stored.waybackLookupStatus, 'found');
  assert.equal(
    stored.waybackAvailabilityUrl,
    'https://web.archive.org/web/20260214093311/https://bls.gov/b',
  );
  assert.equal(stored.waybackAvailabilitySource, 'availability-lookup');
  assert.equal(stored.waybackStatus, 'failed');
  const [detail] = retrievalDetails(db.writes);
  assert.equal(detail?.waybackLookupStatus, 'found');
});

test('--wayback falls through to SPN when the lookup finds nothing', async () => {
  const db = fakeDb();
  const lookup = fakeLookup(() => ({ status: 'miss', reason: 'no_snapshot' }));
  const waybackAnchor: WaybackAnchor = {
    async captureUrl(url) {
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
    { ...deps(async () => ok('g'.repeat(64))), waybackAnchor, waybackLookup: lookup },
  );

  assert.equal(report.wayback.attempted, 1);
  assert.equal(report.wayback.anchored, 1);
  const captureWrite = db.writes.find((w) => w.sql.includes('source_captures'));
  const stored = JSON.parse(String(captureWrite?.params?.[7] ?? '{}')) as Record<string, unknown>;
  assert.equal(stored.waybackLookupStatus, 'miss');
  assert.equal(stored.waybackStatus, 'anchored');
  assert.equal(
    stored.waybackCaptureUrl,
    'https://web.archive.org/web/20260901150000/https://bls.gov/b',
  );
});

test('a successful capture with --wayback off costs no lookup request', async () => {
  const db = fakeDb();
  const lookup = fakeLookup(foundSnapshot);
  const report = await runCaptureBackfill(
    db,
    { commit: true, maxCaptures: 1 },
    { ...deps(async () => ok('h'.repeat(64))), waybackLookup: lookup },
  );
  assert.equal(report.captured, 1);
  assert.deepEqual(lookup.asked, [], 'nothing to fall back from, and no SPN job to spare');
  assert.equal(report.waybackLookup.attempted, 0);
});

test('dry-run never reaches archive.org even with a lookup wired', async () => {
  const db = fakeDb();
  const lookup = fakeLookup(foundSnapshot);
  const report = await runCaptureBackfill(
    db,
    { commit: false },
    { ...deps(async () => FAILED_FETCH), waybackLookup: lookup },
  );
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.waybackLookup.available, true);
  assert.equal(report.waybackLookup.attempted, 0);
  assert.deepEqual(lookup.asked, []);
});

test('with no lookup wired the lane behaves exactly as before', async () => {
  const db = fakeDb();
  const report = await runCaptureBackfill(
    db,
    { commit: true },
    deps(async () => FAILED_FETCH),
  );
  assert.equal(report.waybackLookup.available, false);
  assert.equal(report.waybackLookup.attempted, 0);
  const details = retrievalDetails(db.writes);
  assert.equal(details[0]?.waybackLookupStatus, undefined);
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
  assert.equal(report.inventoryFingerprint.length, 64);
  await assert.rejects(
    runCaptureBackfill(
      db,
      { commit: true, maxEntities: 2, afterUrl: 'https://b.gov/1' },
      deps(async () => ok('z'.repeat(64))),
    ),
    /afterUrl cannot be combined with maxEntities/,
  );
});

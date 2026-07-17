/**
 * Tests for the BB-091 idempotent jurisdiction load/refresh orchestration (`runJurisdictionLoad`).
 * Uses an injected in-memory writer — no Firestore/network dependency, matching
 * embeddings/backfill-cli.test.ts's approach for the same reason.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  jurisdictionDocsEqualIgnoringTimestamps,
  runJurisdictionLoad,
  type JurisdictionWriteOutcome,
  type JurisdictionWriter,
} from './load-cli.js';
import type { JurisdictionDoc } from './schema.js';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/sample-gazetteer-counties.txt', import.meta.url));

async function loadFixture(): Promise<string> {
  return readFile(FIXTURE_PATH, 'utf-8');
}

/** In-memory stand-in for Firestore: same idempotent compare-then-set logic the real CLI uses. */
function createInMemoryWriter(): JurisdictionWriter & { readonly store: Map<string, JurisdictionDoc> } {
  const store = new Map<string, JurisdictionDoc>();
  return {
    store,
    async upsert(doc: JurisdictionDoc): Promise<JurisdictionWriteOutcome> {
      const existing = store.get(doc.id);
      if (existing && jurisdictionDocsEqualIgnoringTimestamps(existing, doc)) {
        return 'unchanged';
      }
      store.set(doc.id, doc);
      return existing ? 'updated' : 'created';
    },
  };
}

test('runJurisdictionLoad with states only writes exactly 52 docs (51 states + country)', async () => {
  const writer = createInMemoryWriter();
  const summary = await runJurisdictionLoad({ writer, now: () => '2026-01-01T00:00:00.000Z' });
  assert.equal(summary.statesProcessed, 52);
  assert.equal(summary.countiesProcessed, 0);
  assert.equal(summary.created, 52);
  assert.equal(summary.updated, 0);
  assert.equal(summary.unchanged, 0);
  assert.equal(writer.store.size, 52);
});

test('runJurisdictionLoad with a Gazetteer file also loads in-scope counties and skips territories', async () => {
  const writer = createInMemoryWriter();
  const gazetteerFileText = await loadFixture();
  const summary = await runJurisdictionLoad({
    writer,
    gazetteerFileText,
    now: () => '2026-01-01T00:00:00.000Z',
  });
  assert.equal(summary.countiesProcessed, 4); // 5 fixture rows minus 1 out-of-scope (PR)
  assert.equal(summary.outOfScopeCounties.length, 1);
  assert.equal(summary.outOfScopeCounties[0]!.usps, 'PR');
  assert.equal(summary.rejectedGazetteerRows.length, 0);
  assert.equal(writer.store.size, 56); // 52 states/country + 4 counties
});

test('runJurisdictionLoad is idempotent: re-running with identical inputs writes nothing new', async () => {
  const writer = createInMemoryWriter();
  const gazetteerFileText = await loadFixture();

  const first = await runJurisdictionLoad({
    writer,
    gazetteerFileText,
    now: () => '2026-01-01T00:00:00.000Z',
  });
  assert.equal(first.created, 56);
  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 0);

  // Re-run with a different `now` (simulating a later refresh run) but identical source data.
  const second = await runJurisdictionLoad({
    writer,
    gazetteerFileText,
    now: () => '2027-06-15T00:00:00.000Z',
  });
  assert.equal(second.created, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.unchanged, 56);
  // The store still has exactly 56 docs — nothing duplicated, nothing dropped.
  assert.equal(writer.store.size, 56);
});

test('runJurisdictionLoad reports an update when a jurisdiction doc genuinely changes', async () => {
  const writer = createInMemoryWriter();
  await runJurisdictionLoad({ writer, now: () => '2026-01-01T00:00:00.000Z' });

  // Simulate an upstream state bbox tweak by mutating the stored doc directly, then re-running.
  const california = writer.store.get('us-06')!;
  writer.store.set('us-06', { ...california, name: 'STALE NAME' });

  const summary = await runJurisdictionLoad({ writer, now: () => '2027-01-01T00:00:00.000Z' });
  assert.equal(summary.updated, 1);
  assert.equal(summary.unchanged, 51); // every other state/country doc is untouched
  assert.equal(writer.store.get('us-06')!.name, 'California');
});

test('jurisdictionDocsEqualIgnoringTimestamps ignores createdAt/updatedAt but not content', () => {
  const base: JurisdictionDoc = {
    id: 'us-06',
    kind: 'state',
    name: 'California',
    sourceDataset: 'us-geography-module',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const sameContentLaterTimestamp: JurisdictionDoc = { ...base, updatedAt: '2027-01-01T00:00:00.000Z' };
  const differentContent: JurisdictionDoc = { ...base, name: 'Different' };

  assert.ok(jurisdictionDocsEqualIgnoringTimestamps(base, sameContentLaterTimestamp));
  assert.ok(!jurisdictionDocsEqualIgnoringTimestamps(base, differentContent));
});

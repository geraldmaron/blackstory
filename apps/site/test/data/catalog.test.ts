import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { resetCacheRegistryForTests } from '../../src/server/data/cache';
import {
  CatalogUnavailableError,
  createCatalog,
  type CatalogDeps,
} from '../../src/server/data/catalog';

const REL = { releaseId: 'rel_1', activatedAt: '2026-10-01T00:00:00.000Z' };
type Doc = { id: string; ready: boolean };
const doc = (id: string, ready = true): Doc => ({ id, ready });

function harness(over: Partial<CatalogDeps> = {}, release: typeof REL | null = REL) {
  const calls = { artifact: 0, postgres: 0, release: 0 };
  const warnings: string[] = [];
  const deps: CatalogDeps = {
    preferArtifacts: () => true,
    fetchArtifact: async () => {
      calls.artifact += 1;
      return { docs: [doc('a'), doc('b')] };
    },
    listPostgresDocs: async () => {
      calls.postgres += 1;
      return [doc('p1'), doc('p2'), doc('p3')];
    },
    parse: (value) => value,
    map: ((value: Doc) => value) as never,
    ready: ((docs: Doc[]) => docs.every((d) => d.ready)) as never,
    warn: (message) => warnings.push(message),
    ...over,
  };
  const catalog = createCatalog(deps, async () => ((calls.release += 1), release ?? undefined));
  return { catalog, calls, warnings };
}

beforeEach(() => resetCacheRegistryForTests());

test('a ready artifact is used and Postgres is never read', async () => {
  const h = harness();
  const result = await h.catalog.getSearchIndex();
  assert.deepEqual(
    result.docs.map((d) => (d as unknown as Doc).id),
    ['a', 'b'],
  );
  assert.deepEqual(result.release, REL);
  assert.deepEqual([h.calls.artifact, h.calls.postgres], [1, 0]);
});

test('the second read is a cache hit: no artifact fetch, no Postgres read', async () => {
  const h = harness();
  await h.catalog.getSearchIndex();
  await h.catalog.getSearchIndex();
  await h.catalog.getSearchIndex();
  assert.deepEqual([h.calls.artifact, h.calls.postgres], [1, 0]);
  assert.equal(
    h.calls.release,
    3,
    'the release pointer is asked every time (it has its own 30 s memo)',
  );
});

test('concurrent first reads share one load', async () => {
  const h = harness();
  await Promise.all(Array.from({ length: 20 }, () => h.catalog.getSearchIndex()));
  assert.equal(h.calls.artifact, 1);
});

test('an artifact without evidence coverage falls back to Postgres, and says so', async () => {
  const h = harness({ fetchArtifact: async () => ({ docs: [doc('a', false)] }) });
  const result = await h.catalog.getSearchIndex();
  assert.deepEqual(
    result.docs.map((d) => (d as unknown as Doc).id),
    ['p1', 'p2', 'p3'],
  );
  assert.ok(h.warnings.some((w) => w.includes('evidenceInputs coverage')));
});

test('an unusable artifact falls back to Postgres, and says so', async () => {
  const h = harness({ fetchArtifact: async () => undefined });
  const result = await h.catalog.getSearchIndex();
  assert.equal(result.docs.length, 3);
  assert.ok(h.warnings.some((w) => w.includes('full Postgres search-index pull')));
});

test('an empty artifact falls back to Postgres', async () => {
  const h = harness({ fetchArtifact: async () => ({ docs: [] }) });
  assert.equal((await h.catalog.getSearchIndex()).docs.length, 3);
});

test('when Postgres has nothing, the partly-covered artifact is better than nothing', async () => {
  const h = harness({
    fetchArtifact: async () => ({ docs: [doc('a', false)] }),
    listPostgresDocs: async () => [],
  });
  assert.deepEqual(
    (await h.catalog.getSearchIndex()).docs.map((d) => (d as unknown as Doc).id),
    ['a'],
  );
});

test('without the artifact preference Postgres is read directly and the artifact is not fetched', async () => {
  const h = harness({ preferArtifacts: () => false });
  assert.equal((await h.catalog.getSearchIndex()).docs.length, 3);
  assert.deepEqual([h.calls.artifact, h.calls.postgres], [0, 1]);
});

test('docs the contract rejects are dropped, not rendered', async () => {
  const h = harness({
    fetchArtifact: async () => ({ docs: [doc('a'), { bad: true }, doc('b')] }),
    parse: (value) => ((value as Doc).id ? value : undefined),
  });
  assert.deepEqual(
    (await h.catalog.getSearchIndex()).docs.map((d) => (d as unknown as Doc).id),
    ['a', 'b'],
  );
});

test('no live release, or nothing anywhere, is an explicit CatalogUnavailableError', async () => {
  await assert.rejects(harness({}, null).catalog.getSearchIndex(), CatalogUnavailableError);
  resetCacheRegistryForTests();
  const empty = harness({ fetchArtifact: async () => undefined, listPostgresDocs: async () => [] });
  await assert.rejects(empty.catalog.getSearchIndex(), CatalogUnavailableError);
});

test('a database error with no last good value propagates (stale-if-error itself is covered in cache.test.ts)', async () => {
  resetCacheRegistryForTests();
  const failing = harness({
    fetchArtifact: async () => undefined,
    listPostgresDocs: async () => {
      throw new Error('connection refused');
    },
  });
  await assert.rejects(failing.catalog.getSearchIndex(), /connection refused/);
});

test('a purge makes the next read load again', async () => {
  const h = harness();
  await h.catalog.getSearchIndex();
  h.catalog.searchIndexCache.invalidate();
  await h.catalog.getSearchIndex();
  assert.equal(h.calls.artifact, 2);
});

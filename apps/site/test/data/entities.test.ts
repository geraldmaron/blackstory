import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { listCaches, resetCacheRegistryForTests } from '../../src/server/data/cache';
import { CatalogUnavailableError } from '../../src/server/data/catalog';
import {
  createEntityCatalog,
  MAX_ENTITY_ID_LENGTH,
  type EntityDeps,
} from '../../src/server/data/entities';

const REL = { releaseId: 'rel_1', activatedAt: '2026-10-01T00:00:00.000Z' };
type View = { id: string };
type Projection = { id: string };
const view = (id: string): View => ({ id });

function harness(
  over: Partial<EntityDeps<View, Projection>> = {},
  release: typeof REL | null = REL,
) {
  const calls = { artifact: 0, list: 0, neighborhood: 0, thin: 0, redirect: 0, release: 0 };
  const warnings: string[] = [];
  const deps: EntityDeps<View, Projection> = {
    preferArtifacts: () => true,
    fetchEntitiesArtifact: async () => (
      (calls.artifact += 1),
      { entities: [{ id: 'a' }, { id: 'b' }] }
    ),
    listProjections: async () => ((calls.list += 1), [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]),
    projectionsFromArtifact: (entities) => entities as Projection[],
    hydrateAll: (projections) => projections.map((p) => view(p.id)),
    loadNeighborhood: async (_release, id) => (
      (calls.neighborhood += 1),
      id.startsWith('missing') ? undefined : view(id)
    ),
    loadThin: async (_release, ids) => (
      (calls.thin += 1),
      ids.filter((id) => !id.startsWith('missing')).map(view)
    ),
    fetchRedirect: async (_release, id) => (
      (calls.redirect += 1),
      id === 'old' ? 'new' : undefined
    ),
    idOf: (v) => v.id,
    warn: (message) => warnings.push(message),
    ...over,
  };
  const entities = createEntityCatalog(
    deps,
    async () => ((calls.release += 1), release ?? undefined),
  );
  return { entities, calls, warnings };
}

beforeEach(() => resetCacheRegistryForTests());

test('getEntities prefers the artifact and caches the hydrated catalog', async () => {
  const h = harness();
  const first = await h.entities.getEntities();
  assert.deepEqual(
    first.data.map((v) => v.id),
    ['a', 'b'],
  );
  assert.deepEqual(first.release, REL);
  await h.entities.getEntities();
  assert.deepEqual([h.calls.artifact, h.calls.list], [1, 0]);
});

test('an artifact whose entries all fail to parse falls back to Postgres and says so', async () => {
  const h = harness({ projectionsFromArtifact: () => [] });
  assert.equal((await h.entities.getEntities()).data.length, 3);
  assert.ok(h.warnings.some((w) => w.includes('none parsed')));
  assert.ok(h.warnings.some((w) => w.includes('full Postgres entity catalog pull')));
});

test('an unusable or empty artifact falls back to Postgres; without the preference the artifact is never fetched', async () => {
  assert.equal(
    (await harness({ fetchEntitiesArtifact: async () => undefined }).entities.getEntities()).data
      .length,
    3,
  );
  resetCacheRegistryForTests();
  assert.equal(
    (
      await harness({
        fetchEntitiesArtifact: async () => ({ entities: [] }),
      }).entities.getEntities()
    ).data.length,
    3,
  );
  resetCacheRegistryForTests();
  const direct = harness({ preferArtifacts: () => false });
  await direct.entities.getEntities();
  assert.deepEqual([direct.calls.artifact, direct.calls.list], [0, 1]);
});

test('no release, or an empty catalog everywhere, is an explicit CatalogUnavailableError', async () => {
  await assert.rejects(harness({}, null).entities.getEntities(), CatalogUnavailableError);
  resetCacheRegistryForTests();
  const empty = harness({
    fetchEntitiesArtifact: async () => undefined,
    listProjections: async () => [],
  });
  await assert.rejects(empty.entities.getEntities(), CatalogUnavailableError);
});

test('getEntity: a hit and a miss are each read once, however often they are asked for', async () => {
  const h = harness();
  assert.deepEqual(await h.entities.getEntity('e1'), view('e1'));
  assert.deepEqual(await h.entities.getEntity('e1'), view('e1'));
  assert.equal(await h.entities.getEntity('missing-1'), undefined);
  assert.equal(await h.entities.getEntity('missing-1'), undefined);
  assert.equal(h.calls.neighborhood, 2, 'one read for e1, one for the cached miss');
  assert.deepEqual(await h.entities.getEntity('e2'), view('e2'));
  assert.equal(h.calls.neighborhood, 3, 'a different id is a different key');
});

test('getEntity trims the id and shares one read across concurrent callers', async () => {
  const h = harness();
  const results = await Promise.all(
    Array.from({ length: 15 }, (_, i) => h.entities.getEntity(i % 2 ? ' e1 ' : 'e1')),
  );
  assert.ok(results.every((r) => r?.id === 'e1'));
  assert.equal(h.calls.neighborhood, 1);
});

test('getEntity answers undefined without a read for a missing release or an unusable id', async () => {
  const noRelease = harness({}, null);
  assert.equal(await noRelease.entities.getEntity('e1'), undefined);
  assert.equal(noRelease.calls.neighborhood, 0);
  const h = harness();
  assert.equal(await h.entities.getEntity(''), undefined);
  assert.equal(await h.entities.getEntity('x'.repeat(MAX_ENTITY_ID_LENGTH + 1)), undefined);
  assert.deepEqual(
    await h.entities.getEntity('x'.repeat(MAX_ENTITY_ID_LENGTH)),
    view('x'.repeat(MAX_ENTITY_ID_LENGTH)),
  );
  assert.equal(h.calls.release >= 1, true);
  assert.equal(h.calls.neighborhood, 1, 'only the id at the limit reached the database');
});

test('a failing first read propagates and is not cached', async () => {
  let fail = true;
  const h = harness({
    loadNeighborhood: async (_r, id) => {
      if (fail) throw new Error('db down');
      return view(id);
    },
  });
  await assert.rejects(h.entities.getEntity('e1'), /db down/);
  fail = false;
  assert.deepEqual(await h.entities.getEntity('e1'), view('e1'));
});

test('getEntitiesByIds deduplicates, keeps request order, omits misses, and loads once per id set', async () => {
  const h = harness();
  const out = await h.entities.getEntitiesByIds(['c', 'a', ' c ', 'missing-x', 'b', '']);
  assert.deepEqual(
    out.map((v) => v.id),
    ['c', 'a', 'b'],
  );
  const again = await h.entities.getEntitiesByIds(['b', 'a', 'c', 'missing-x']);
  assert.deepEqual(
    again.map((v) => v.id),
    ['b', 'a', 'c'],
    'same set, other order: cached read, answered in the new request order',
  );
  assert.equal(h.calls.thin, 1);
  await h.entities.getEntitiesByIds(['a', 'b']);
  assert.equal(h.calls.thin, 2, 'a different set is a different read');
});

test('getEntitiesByIds: nothing requested, nothing readable, or no release is an empty list without a read', async () => {
  const h = harness();
  assert.deepEqual(await h.entities.getEntitiesByIds([]), []);
  assert.deepEqual(await h.entities.getEntitiesByIds(['', '  ']), []);
  assert.deepEqual(await h.entities.getEntitiesByIds(['x'.repeat(MAX_ENTITY_ID_LENGTH + 1)]), []);
  assert.equal(h.calls.thin, 0);
  assert.ok(h.warnings.some((w) => w.includes('over-long id')));
  assert.deepEqual(await harness({}, null).entities.getEntitiesByIds(['a']), []);
});

test('redirects: found, not found (cached as a miss), and a failing lookup that is never cached', async () => {
  const h = harness();
  assert.equal(await h.entities.getEntityRedirect('old'), 'new');
  assert.equal(await h.entities.getEntityRedirect('old'), 'new');
  assert.equal(await h.entities.getEntityRedirect('nope'), undefined);
  assert.equal(await h.entities.getEntityRedirect('nope'), undefined);
  assert.equal(h.calls.redirect, 2, 'one query per distinct id');

  let fail = true;
  const flaky = harness({
    fetchRedirect: async () => {
      if (fail) throw new Error('timeout');
      return 'there';
    },
  });
  assert.equal(await flaky.entities.getEntityRedirect('old'), undefined);
  assert.ok(flaky.warnings.some((w) => w.includes('redirect lookup failed')));
  fail = false;
  assert.equal(
    await flaky.entities.getEntityRedirect('old'),
    'there',
    'the failure was not cached',
  );
  assert.equal(await h.entities.getEntityRedirect(''), undefined);
});

test('junk ids cannot grow memory: the per-entity cache is LRU-bounded', async () => {
  const h = harness();
  for (let i = 0; i < 650; i += 1) await h.entities.getEntity(`missing-${i}`);
  const entityCache = h.entities.caches.find((c) => c.kind === 'public-release-entity');
  assert.ok(entityCache);
  assert.ok(entityCache.stats().entries <= 500, `entries ${entityCache.stats().entries}`);
});

test('every entity cache registers, so a purge reaches all four', async () => {
  harness();
  assert.deepEqual(
    listCaches()
      .map((c) => c.kind)
      .sort(),
    [
      'public-release-entities',
      'public-release-entities-by-ids',
      'public-release-entity',
      'public-release-entity-redirect',
    ],
  );
});

test('a purge makes every read load again', async () => {
  const h = harness();
  await h.entities.getEntity('e1');
  await h.entities.getEntitiesByIds(['a']);
  await h.entities.getEntities();
  for (const cache of h.entities.caches) cache.invalidate();
  await h.entities.getEntity('e1');
  await h.entities.getEntitiesByIds(['a']);
  await h.entities.getEntities();
  assert.deepEqual([h.calls.neighborhood, h.calls.thin, h.calls.artifact], [2, 2, 2]);
});

test('different id sets never share a by-ids entry, even when an id contains a separator', async () => {
  const h = harness({
    loadThin: async (_r, ids) => ids.filter((id) => !id.includes('\u0001')).map(view),
  });
  assert.deepEqual(await h.entities.getEntitiesByIds(['a\u0001b']), []);
  assert.deepEqual(
    (await h.entities.getEntitiesByIds(['a', 'b'])).map((v) => v.id),
    ['a', 'b'],
  );
});

test('a cached miss is not served as stale-if-error after it expires, but a cached hit is', async () => {
  let at = 1_000_000;
  let down = false;
  const calls = { release: 0 };
  const deps: EntityDeps<View, Projection> = {
    preferArtifacts: () => false,
    fetchEntitiesArtifact: async () => undefined,
    listProjections: async () => [],
    projectionsFromArtifact: () => [],
    hydrateAll: () => [],
    loadNeighborhood: async (_release, id) => {
      if (down) throw new Error('db down');
      return id.startsWith('missing') ? undefined : view(id);
    },
    loadThin: async () => [],
    fetchRedirect: async () => undefined,
    idOf: (v) => v.id,
    warn: () => {},
  };
  const entities = createEntityCatalog(deps, async () => ((calls.release += 1), REL), {
    now: () => at,
  });
  assert.equal(await entities.getEntity('missing-1'), undefined);
  assert.deepEqual(await entities.getEntity('e1'), view('e1'));
  at += 31 * 60_000; // past the hard TTL
  down = true;
  await assert.rejects(
    entities.getEntity('missing-1'),
    /db down/,
    'the cached 404 must not become a six-hour 404',
  );
  assert.deepEqual(
    await entities.getEntity('e1'),
    view('e1'),
    'a record that existed is still served while the database is down',
  );
});

test('getEntities pinned to a release uses that release, not a fresh pointer read', async () => {
  const h = harness();
  const other = { releaseId: 'rel_2', activatedAt: '2026-10-02T00:00:00.000Z' };
  const result = await h.entities.getEntities(other);
  assert.deepEqual(result.release, other);
  assert.equal(h.calls.release, 0, 'the pointer was not consulted');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOperator, isPurgeAuthorized, isPurgeScope } from '../../src/server/data/purge';

function targets() {
  const state = { aInvalidated: 0, bInvalidated: 0, pointerInvalidated: 0 };
  const stats = (kind: string) => ({
    kind,
    entries: 1,
    hits: 0,
    misses: 0,
    loads: 0,
    refreshes: 0,
    errors: 0,
    staleServed: 0,
    lastLoadMs: null,
    lastLoadedAt: null,
    lastKey: null,
  });
  const caches = [
    { kind: 'a', invalidate: () => ((state.aInvalidated += 1), 3), stats: () => stats('a') },
    { kind: 'b', invalidate: () => ((state.bInvalidated += 1), 2), stats: () => stats('b') },
  ];
  const releasePointer = {
    getActiveRelease: async () => undefined,
    invalidate: () => void (state.pointerInvalidated += 1),
    stats: () => ({ cached: false, expiresInMs: null, releaseId: null }),
  };
  return { state, operator: createOperator({ caches: () => caches, releasePointer }) };
}

test('scope all clears every cache and the release pointer', () => {
  const { state, operator } = targets();
  const result = operator.purge('all');
  assert.deepEqual(result, {
    scope: 'all',
    droppedEntries: 5,
    releasePointerCleared: true,
    caches: ['a', 'b'],
  });
  assert.deepEqual(state, { aInvalidated: 1, bInvalidated: 1, pointerInvalidated: 1 });
});

test('scope catalog leaves the release pointer; scope release-pointer leaves the caches', () => {
  const one = targets();
  assert.equal(one.operator.purge('catalog').releasePointerCleared, false);
  assert.equal(one.state.pointerInvalidated, 0);
  const two = targets();
  const result = two.operator.purge('release-pointer');
  assert.deepEqual([result.droppedEntries, result.caches], [0, []]);
  assert.deepEqual(two.state, { aInvalidated: 0, bInvalidated: 0, pointerInvalidated: 1 });
});

test('the report lists the pointer and every cache', () => {
  const { operator } = targets();
  const report = operator.report();
  assert.deepEqual(
    report.caches.map((c) => c.kind),
    ['a', 'b'],
  );
  assert.equal(report.releasePointer.cached, false);
});

test('scope validation', () => {
  for (const ok of ['all', 'catalog', 'release-pointer']) assert.equal(isPurgeScope(ok), true, ok);
  for (const bad of ['', 'ALL', 'everything', 3, null, undefined, {}])
    assert.equal(isPurgeScope(bad), false, String(bad));
});

test('bearer token authorization', () => {
  const token = 'a-long-enough-token-1234';
  assert.equal(isPurgeAuthorized(`Bearer ${token}`, token), true);
  assert.equal(isPurgeAuthorized(`bearer ${token}`, token), true, 'the scheme is case-insensitive');
  assert.equal(isPurgeAuthorized(`Bearer ${token}x`, token), false);
  assert.equal(isPurgeAuthorized(`Bearer ${token.slice(0, -1)}`, token), false);
  assert.equal(isPurgeAuthorized(token, token), false, 'the scheme is required');
  assert.equal(isPurgeAuthorized(null, token), false);
  assert.equal(isPurgeAuthorized('Bearer ', token), false);
});

test('an unset or short token disables the endpoint: nothing authorizes, not even a matching string', () => {
  assert.equal(isPurgeAuthorized('Bearer short', 'short'), false);
  assert.equal(isPurgeAuthorized('Bearer ', ''), false);
  assert.equal(isPurgeAuthorized('Bearer x', undefined), false);
});

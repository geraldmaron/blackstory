import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTIVE_RELEASE_POINTER_TTL_MS, createReleasePointer } from '../../src/server/data/release';

const ACTIVE = { releaseId: 'rel_1', activatedAt: '2026-10-01T00:00:00.000Z' };

function harness(over: { live?: boolean; fetch?: () => Promise<typeof ACTIVE | undefined> } = {}) {
  let at = 0;
  let calls = 0;
  const pointer = createReleasePointer({
    isLive: () => over.live ?? true,
    now: () => at,
    fetchActive: async () => {
      calls += 1;
      return over.fetch ? over.fetch() : ACTIVE;
    },
  });
  return { pointer, advance: (ms: number) => void (at += ms), calls: () => calls };
}

test('the pointer is memoized for 30 seconds', async () => {
  const h = harness();
  assert.deepEqual(await h.pointer.getActiveRelease(), ACTIVE);
  await h.pointer.getActiveRelease();
  assert.equal(h.calls(), 1);
  h.advance(ACTIVE_RELEASE_POINTER_TTL_MS - 1);
  await h.pointer.getActiveRelease();
  assert.equal(h.calls(), 1);
  h.advance(2);
  await h.pointer.getActiveRelease();
  assert.equal(h.calls(), 2);
  assert.equal(ACTIVE_RELEASE_POINTER_TTL_MS, 30_000);
});

test('a burst reads the pointer once', async () => {
  const h = harness();
  await Promise.all(Array.from({ length: 30 }, () => h.pointer.getActiveRelease()));
  assert.equal(h.calls(), 1);
});

test('when public data is not live the database is never touched', async () => {
  const h = harness({ live: false });
  assert.equal(await h.pointer.getActiveRelease(), undefined);
  assert.equal(h.calls(), 0);
});

test('"no release" is never memoized, so a transient miss does not pin it', async () => {
  let returnUndefined = true;
  const h = harness({ fetch: async () => (returnUndefined ? undefined : ACTIVE) });
  assert.equal(await h.pointer.getActiveRelease(), undefined);
  returnUndefined = false;
  assert.deepEqual(await h.pointer.getActiveRelease(), ACTIVE);
});

test('an error is not memoized and propagates', async () => {
  let fail = true;
  const h = harness({
    fetch: async () => {
      if (fail) throw new Error('db');
      return ACTIVE;
    },
  });
  await assert.rejects(h.pointer.getActiveRelease(), /db/);
  fail = false;
  assert.deepEqual(await h.pointer.getActiveRelease(), ACTIVE);
});

test('invalidate forces the next read to hit the database; stats describe the memo', async () => {
  const h = harness();
  await h.pointer.getActiveRelease();
  assert.deepEqual(
    {
      cached: h.pointer.stats().cached,
      releaseId: h.pointer.stats().releaseId,
      expiresInMs: h.pointer.stats().expiresInMs,
    },
    { cached: true, releaseId: 'rel_1', expiresInMs: 30_000 },
  );
  h.pointer.invalidate();
  assert.equal(h.pointer.stats().cached, false);
  await h.pointer.getActiveRelease();
  assert.equal(h.calls(), 2);
});

test('a purge fences a pointer query already in flight and a later reader never joins it', async () => {
  let at = 0;
  let activeRelease = { releaseId: 'rel_A', activatedAt: '2026-10-01T00:00:00.000Z' };
  const pending: ((value: { releaseId: string; activatedAt: string }) => void)[] = [];
  const pointer = createReleasePointer({
    isLive: () => true,
    now: () => at,
    fetchActive: () => {
      const answer = activeRelease;
      return new Promise((resolve) => pending.push(() => resolve(answer)));
    },
  });
  const first = pointer.getActiveRelease();
  await new Promise((resolve) => setImmediate(resolve));
  activeRelease = { releaseId: 'rel_B', activatedAt: '2026-10-02T00:00:00.000Z' };
  pointer.invalidate();
  const second = pointer.getActiveRelease();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2, 'the post-purge reader started its own query');
  pending[1]!({ releaseId: 'rel_B', activatedAt: 'x' });
  await new Promise((resolve) => setImmediate(resolve));
  pending[0]!({ releaseId: 'rel_A', activatedAt: 'x' }); // the stale answer lands last
  assert.equal((await first)?.releaseId, 'rel_A', 'the old query still answers its own caller');
  assert.equal((await second)?.releaseId, 'rel_B');
  at += 1;
  assert.equal(pointer.stats().releaseId, 'rel_B', 'and only the post-purge answer was memoized');
});

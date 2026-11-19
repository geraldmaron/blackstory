import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COVER_ANSWER_TTL_MS, isbnsKnownWithoutCovers } from './books-cover-availability';

test('cover checks never hold up a render, and their answers expire', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: string) => {
    calls += 1;
    return new Response(null, { status: String(url).includes('0000000000') ? 404 : 200 });
  }) as typeof fetch;
  try {
    // Cold: nothing is known yet, so nothing is dropped, and the checks run in the background.
    assert.deepEqual([...isbnsKnownWithoutCovers(['0000000000', '9780307278449'])], []);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 2);
    // Warm: the missing cover is known and no new request goes out.
    assert.deepEqual([...isbnsKnownWithoutCovers(['0000000000', '9780307278449'])], ['0000000000']);
    assert.equal(calls, 2);
    // Expired: the answer no longer counts and is asked again.
    const later = Date.now() + COVER_ANSWER_TTL_MS + 1;
    assert.deepEqual([...isbnsKnownWithoutCovers(['0000000000'], 'M', later)], []);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = realFetch;
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ArtifactUploadError,
  publishArtifactWithRetry,
  retryWithBackoff,
  uploadArtifactJson,
} from './release-catalog-publish-upload.ts';

function noSleep() {
  const delays: number[] = [];
  return { sleep: async (ms: number) => void delays.push(ms), delays };
}

test('retryWithBackoff: returns the result on first success, no sleeps', async () => {
  const { sleep, delays } = noSleep();
  let calls = 0;
  const result = await retryWithBackoff(
    async () => {
      calls += 1;
      return 'ok';
    },
    { sleep },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});

test('retryWithBackoff: retries on failure and succeeds within maxAttempts, backing off exponentially', async () => {
  const { sleep, delays } = noSleep();
  let calls = 0;
  const result = await retryWithBackoff(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error(`transient failure ${calls}`);
      return 'ok';
    },
    { sleep, baseDelayMs: 100, maxAttempts: 5 },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  // baseDelayMs * 2^(attempt-1) for the two failed attempts (attempt 1, then attempt 2)
  assert.deepEqual(delays, [100, 200]);
});

test('retryWithBackoff: exhausts maxAttempts and rethrows the last error', async () => {
  const { sleep } = noSleep();
  let calls = 0;
  await assert.rejects(
    () =>
      retryWithBackoff(
        async () => {
          calls += 1;
          throw new Error(`always fails ${calls}`);
        },
        { sleep, baseDelayMs: 10, maxAttempts: 3 },
      ),
    /always fails 3/,
  );
  assert.equal(calls, 3);
});

test('uploadArtifactJson: wraps a raw fetch rejection with objectPath, URL, and the cause message', async () => {
  const fetchImpl = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  await assert.rejects(
    () =>
      uploadArtifactJson('public/releases/r1/entities.json', '{}', {
        supabaseUrl: 'https://example.supabase.co',
        secretKey: 'secret',
        bucket: 'public-media',
        cacheControl: 'max-age=300',
        fetchImpl,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ArtifactUploadError);
      assert.match(error.message, /public\/releases\/r1\/entities\.json/);
      assert.match(
        error.message,
        /https:\/\/example\.supabase\.co\/storage\/v1\/object\/public-media\/public\/releases\/r1\/entities\.json/,
      );
      assert.match(error.message, /fetch failed/);
      assert.equal(error.details.status, undefined);
      return true;
    },
  );
});

test('uploadArtifactJson: wraps a non-ok response with the status code, URL, and object path', async () => {
  const fetchImpl = (async () =>
    new Response('service unavailable', { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(
    () =>
      uploadArtifactJson('public/releases/r1/search-index.json', '{}', {
        supabaseUrl: 'https://example.supabase.co',
        secretKey: 'secret',
        bucket: 'public-media',
        cacheControl: 'max-age=300',
        fetchImpl,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ArtifactUploadError);
      assert.match(error.message, /503/);
      assert.match(error.message, /public\/releases\/r1\/search-index\.json/);
      assert.match(error.message, /service unavailable/);
      assert.equal(error.details.status, 503);
      return true;
    },
  );
});

test('uploadArtifactJson: resolves cleanly on a 2xx response', async () => {
  const fetchImpl = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
  await assert.doesNotReject(() =>
    uploadArtifactJson('public/releases/r1/entities.json', '{}', {
      supabaseUrl: 'https://example.supabase.co',
      secretKey: 'secret',
      bucket: 'public-media',
      cacheControl: 'max-age=300',
      fetchImpl,
    }),
  );
});

test('publishArtifactWithRetry: skips the upload and never persists a hash when content is unchanged', async () => {
  let uploadCalls = 0;
  let persistCalls = 0;
  const result = await publishArtifactWithRetry(
    {
      objectPath: 'entities.json',
      body: '{}',
      newHash: 'abc123',
      previousHash: 'abc123',
      force: false,
    },
    {
      upload: async () => void (uploadCalls += 1),
      persistHash: async () => void (persistCalls += 1),
    },
  );
  assert.deepEqual(result, { uploaded: false });
  assert.equal(uploadCalls, 0);
  assert.equal(persistCalls, 0);
});

test('publishArtifactWithRetry: uploads and persists the new hash when content changed', async () => {
  let uploadedBody: string | undefined;
  let persistedHash: string | undefined;
  const result = await publishArtifactWithRetry(
    {
      objectPath: 'entities.json',
      body: '{"n":1}',
      newHash: 'newhash',
      previousHash: 'oldhash',
      force: false,
    },
    {
      upload: async (_path, body) => void (uploadedBody = body),
      persistHash: async (hash) => void (persistedHash = hash),
    },
  );
  assert.deepEqual(result, { uploaded: true });
  assert.equal(uploadedBody, '{"n":1}');
  assert.equal(persistedHash, 'newhash');
});

test('publishArtifactWithRetry: retries a failing upload before succeeding, then persists the hash', async () => {
  const { sleep } = noSleep();
  let attempts = 0;
  let persistedHash: string | undefined;
  const result = await publishArtifactWithRetry(
    {
      objectPath: 'entities.json',
      body: '{}',
      newHash: 'newhash',
      previousHash: 'oldhash',
      force: false,
    },
    {
      upload: async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('fetch failed');
      },
      persistHash: async (hash) => void (persistedHash = hash),
      retry: { sleep, baseDelayMs: 10, maxAttempts: 3 },
    },
  );
  assert.deepEqual(result, { uploaded: true });
  assert.equal(attempts, 2);
  assert.equal(persistedHash, 'newhash');
});

test('publishArtifactWithRetry: an upload that never succeeds never persists a hash (partial publish stays visible)', async () => {
  const { sleep } = noSleep();
  let persistCalls = 0;
  await assert.rejects(
    () =>
      publishArtifactWithRetry(
        {
          objectPath: 'search-index.json',
          body: '{}',
          newHash: 'newhash',
          previousHash: 'oldhash',
          force: false,
        },
        {
          upload: async () => {
            throw new Error('fetch failed');
          },
          persistHash: async () => void (persistCalls += 1),
          retry: { sleep, baseDelayMs: 10, maxAttempts: 2 },
        },
      ),
    /fetch failed/,
  );
  assert.equal(persistCalls, 0);
});

test('publishArtifactWithRetry: FORCE re-uploads and re-persists even when the hash already matches', async () => {
  let uploadCalls = 0;
  let persistedHash: string | undefined;
  const result = await publishArtifactWithRetry(
    {
      objectPath: 'entities.json',
      body: '{}',
      newHash: 'samehash',
      previousHash: 'samehash',
      force: true,
    },
    {
      upload: async () => void (uploadCalls += 1),
      persistHash: async (hash) => void (persistedHash = hash),
    },
  );
  assert.deepEqual(result, { uploaded: true });
  assert.equal(uploadCalls, 1);
  assert.equal(persistedHash, 'samehash');
});

/**
 * End-to-end shape of the live incident (repo-kywgj, 2026-09-12): entities.json uploads
 * fine, search-index.json fails every retry. The watermark stand-in below must come out of
 * this run with the entities hash updated, the search hash untouched, and — critically —
 * `published_at` never advanced, exactly mirroring what the real script's `main()` does:
 * it awaits the entities publish, then the search publish, and only runs the
 * `published_at` UPDATE after both have resolved.
 */
test('partial publish: a search-index failure after a successful entities upload leaves the watermark correctly half-updated, not advanced', async () => {
  const { sleep } = noSleep();
  const watermark: {
    publishedEntitiesHash: string | null;
    publishedSearchIndexHash: string | null;
    publishedAt: string | null;
  } = {
    publishedEntitiesHash: 'old-entities-hash',
    publishedSearchIndexHash: 'old-search-hash',
    publishedAt: '2026-09-01T00:00:00.000Z',
  };

  async function runPublish(): Promise<void> {
    await publishArtifactWithRetry(
      {
        objectPath: 'entities.json',
        body: '{}',
        newHash: 'new-entities-hash',
        previousHash: watermark.publishedEntitiesHash,
        force: false,
      },
      {
        upload: async () => {
          /* succeeds */
        },
        persistHash: async (hash) => {
          watermark.publishedEntitiesHash = hash;
        },
      },
    );

    await publishArtifactWithRetry(
      {
        objectPath: 'search-index.json',
        body: '{}',
        newHash: 'new-search-hash',
        previousHash: watermark.publishedSearchIndexHash,
        force: false,
      },
      {
        upload: async () => {
          throw new Error('fetch failed');
        },
        persistHash: async (hash) => {
          watermark.publishedSearchIndexHash = hash;
        },
        retry: { sleep, baseDelayMs: 10, maxAttempts: 2 },
      },
    );

    // Only reached once BOTH artifacts are confirmed current — must not run here.
    watermark.publishedAt = '2026-09-12T00:00:00.000Z';
  }

  await assert.rejects(() => runPublish(), /fetch failed/);

  assert.equal(watermark.publishedEntitiesHash, 'new-entities-hash');
  assert.equal(watermark.publishedSearchIndexHash, 'old-search-hash');
  assert.equal(watermark.publishedAt, '2026-09-01T00:00:00.000Z');
});

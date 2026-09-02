/** Verifies the Supabase Storage capture sink: upload call shape, dedup on 409, env config. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupabaseStorage, supabaseStorageConfigFromEnv } from './supabase-storage.ts';

const SHA = 'a'.repeat(64);

function fakeTransport(status: number, calls: { url: string; init: RequestInit }[]) {
  return (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(status >= 400 ? 'Duplicate' : '{}', { status });
  }) as typeof fetch;
}

test('stores the snapshot text content-addressed under captures/<sha256>.txt', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const storage = createSupabaseStorage({
    url: 'https://ref.supabase.co/',
    secretKey: 'test-secret',
    bucket: 'raw-sources',
    transport: fakeTransport(200, calls),
  });
  const object = await storage.store({
    url: 'https://example.org/doc',
    sha256: SHA,
    contentType: 'text/html',
    byteLength: 1234,
    text: 'extracted text',
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url,
    `https://ref.supabase.co/storage/v1/object/raw-sources/captures/${SHA}.txt`,
  );
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer test-secret');
  assert.equal(headers['x-upsert'], 'false');
  assert.equal(calls[0]?.init.body, 'extracted text');
  assert.deepEqual(object, {
    stored: 'supabase-storage',
    bucket: 'raw-sources',
    path: `captures/${SHA}.txt`,
    sourceUrl: 'https://example.org/doc',
    sha256: SHA,
    contentType: 'text/html',
    byteLength: 1234,
    snapshotBytes: 'extracted text'.length,
    deduplicated: false,
  });
});

test('a 409 duplicate is success — same hash, same object', async () => {
  const storage = createSupabaseStorage({
    url: 'https://ref.supabase.co',
    secretKey: 'k',
    bucket: 'raw-sources',
    transport: fakeTransport(409, []),
  });
  const object = await storage.store({
    url: 'https://example.org/doc',
    sha256: SHA,
    contentType: 'text/plain',
    byteLength: 10,
    text: 'x',
  });
  assert.equal(object.deduplicated, true);
});

test('HTTP 400 with KeyAlreadyExists is the same duplicate, not a hard fail', async () => {
  const storage = createSupabaseStorage({
    url: 'https://ref.supabase.co',
    secretKey: 'k',
    bucket: 'raw-sources',
    transport: (async () =>
      new Response(
        JSON.stringify({
          statusCode: '409',
          error: 'Duplicate',
          message: 'The resource already exists',
          code: 'KeyAlreadyExists',
        }),
        { status: 400 },
      )) as typeof fetch,
  });
  const object = await storage.store({
    url: 'https://example.org/doc',
    sha256: SHA,
    contentType: 'text/plain',
    byteLength: 10,
    text: 'x',
  });
  assert.equal(object.deduplicated, true);
});

test('a non-409 error throws with status, never the secret', async () => {
  const storage = createSupabaseStorage({
    url: 'https://ref.supabase.co',
    secretKey: 'super-secret-value',
    bucket: 'raw-sources',
    transport: fakeTransport(403, []),
  });
  await assert.rejects(
    storage.store({ url: 'u', sha256: SHA, contentType: 't', byteLength: 1, text: 'x' }),
    (error: Error) => {
      assert.match(error.message, /403/);
      assert.ok(!error.message.includes('super-secret-value'));
      return true;
    },
  );
});

test('env config: present, aliased key, and absent', () => {
  assert.deepEqual(
    supabaseStorageConfigFromEnv({
      SUPABASE_URL: 'https://r.supabase.co',
      SUPABASE_SECRET_KEY: 'k',
    }),
    { url: 'https://r.supabase.co', secretKey: 'k', bucket: 'raw-sources' },
  );
  assert.equal(
    supabaseStorageConfigFromEnv({
      SUPABASE_URL: 'https://r.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'k2',
      SUPABASE_CAPTURE_BUCKET: 'evidence',
    })?.bucket,
    'evidence',
  );
  assert.equal(supabaseStorageConfigFromEnv({ SUPABASE_URL: 'https://r.supabase.co' }), null);
  assert.equal(supabaseStorageConfigFromEnv({}), null);
});

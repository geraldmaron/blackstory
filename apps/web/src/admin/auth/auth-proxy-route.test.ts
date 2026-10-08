import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { GET, POST } from '../../app/api/admin-auth/[endpoint]/route';

const context = (endpoint: string) => ({ params: Promise.resolve({ endpoint }) });

function configureTestAuth(t: TestContext) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  });
}

test('relays a staff session read with only the publishable key and never caches upstream cookies', async (t) => {
  configureTestAuth(t);
  let upstreamUrl = '';
  let upstreamHeaders = new Headers();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    upstreamUrl = String(input);
    upstreamHeaders = new Headers(init?.headers);
    return new Response('{"id":"staff"}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60',
        'set-cookie': 'upstream-cookie=ignored',
      },
    });
  });

  const response = await GET(
    new Request('https://blackstory.app/api/admin-auth/user', {
      headers: { authorization: 'Bearer staff-token', apikey: 'untrusted-key' },
    }),
    context('user'),
  );

  assert.equal(upstreamUrl, 'https://project.supabase.co/auth/v1/user');
  assert.equal(upstreamHeaders.get('apikey'), 'test-publishable-key');
  assert.equal(upstreamHeaders.get('authorization'), 'Bearer staff-token');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), { id: 'staff' });
});

test('relays password and refresh grants without changing their request bodies', async (t) => {
  configureTestAuth(t);
  const seen: Array<{ url: string; body: string }> = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(input), body: new TextDecoder().decode(init?.body as ArrayBuffer) });
    return Response.json({ access_token: 'test-token' });
  });

  for (const grantType of ['password', 'refresh_token']) {
    const body = JSON.stringify({ grant_type: grantType });
    const response = await POST(
      new Request(`https://blackstory.app/api/admin-auth/token?grant_type=${grantType}`, {
        method: 'POST',
        headers: { origin: 'https://blackstory.app', 'content-type': 'application/json' },
        body,
      }),
      context('token'),
    );
    assert.equal(response.status, 200);
  }
  assert.deepEqual(seen, [
    {
      url: 'https://project.supabase.co/auth/v1/token?grant_type=password',
      body: '{"grant_type":"password"}',
    },
    {
      url: 'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      body: '{"grant_type":"refresh_token"}',
    },
  ]);
});

test('refuses unsupported Auth operations and cross-origin posts before reaching Supabase', async (t) => {
  configureTestAuth(t);
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({}));

  assert.equal(
    (await GET(new Request('https://blackstory.app/api/admin-auth/signup'), context('signup')))
      .status,
    404,
  );
  assert.equal(
    (
      await POST(
        new Request('https://blackstory.app/api/admin-auth/token?grant_type=password', {
          method: 'POST',
          headers: { origin: 'https://other.example' },
          body: '{}',
        }),
        context('token'),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await POST(
        new Request('https://blackstory.app/api/admin-auth/token?grant_type=otp', {
          method: 'POST',
          body: '{}',
        }),
        context('token'),
      )
    ).status,
    400,
  );
  assert.equal(upstream.mock.callCount(), 0);
});

test('accepts the browser Host when Next normalizes the request URL to localhost', async (t) => {
  configureTestAuth(t);
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  const response = await POST(
    new Request('http://localhost:3048/api/admin-auth/token?grant_type=password', {
      method: 'POST',
      headers: { host: '127.0.0.1:3048', origin: 'http://127.0.0.1:3048' },
      body: '{}',
    }),
    context('token'),
  );
  assert.equal(response.status, 200);
  assert.equal(upstream.mock.callCount(), 1);
});

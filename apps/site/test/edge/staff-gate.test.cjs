const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAuthGatedPath,
  isStaffGatePath,
  readStaffRole,
  staffGate,
} = require('../../server/edge/staff-gate.cjs');

const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
};
const request = (over = {}) => ({
  pathname: '/admin/cases',
  search: '?tab=open',
  headers: { cookie: 'sb-a=1; sb-b=two%20words' },
  ...over,
});
const client =
  (user, error = null, refreshed = []) =>
  (url, key, options) => {
    client.seen = { url, key, cookies: options.cookies.getAll() };
    return {
      auth: {
        async getUser() {
          options.cookies.setAll(refreshed);
          return { data: { user }, error };
        },
      },
    };
  };

test('which paths need a session', () => {
  const gated = [
    '/admin',
    '/admin/cases',
    '/admin/cases/1',
    '/design-system',
    '/design-system/tokens',
  ];
  const open = [
    '/admin/login',
    '/admin/login/reset',
    '/admin/api/work',
    '/robots.txt',
    '/favicon.ico',
    '/brand/a.png',
    '/_expo/static/js/a.js',
  ];
  for (const path of gated) assert.equal(isAuthGatedPath(path), true, path);
  for (const path of open) assert.equal(isAuthGatedPath(path), false, path);
  assert.equal(
    isAuthGatedPath('/admin/report.png'),
    true,
    'a static-looking file under /admin is still gated',
  );
  assert.equal(
    isAuthGatedPath('/design-system/logo.svg'),
    true,
    'static-looking files under /design-system are gated too',
  );
  assert.equal(isStaffGatePath('/admin'), true);
  assert.equal(isStaffGatePath('/administrator'), false);
  assert.equal(isStaffGatePath('/design-systems'), false);
});

test('role must be one of the four staff roles', () => {
  for (const role of ['admin', 'research', 'publication', 'security'])
    assert.equal(readStaffRole({ app_role: role }), role);
  for (const role of ['owner', '', null, 3, undefined])
    assert.equal(readStaffRole({ app_role: role }), undefined);
  assert.equal(readStaffRole(undefined), undefined);
});

test('ungated paths pass without touching Supabase', async () => {
  const result = await staffGate(request({ pathname: '/admin/login' }), {
    env,
    createClient: () => assert.fail('no client'),
  });
  assert.deepEqual(result, { pass: true, setCookies: [] });
});

test('missing Supabase config redirects to sign-in with the original target', async () => {
  const result = await staffGate(request(), {
    env: {},
    createClient: () => assert.fail('no client'),
  });
  assert.equal(result.pass, false);
  assert.equal(result.response.status, 307);
  assert.equal(result.response.headers.location, '/admin/login?next=%2Fadmin%2Fcases%3Ftab%3Dopen');
  assert.equal(result.response.headers['cache-control'], 'private, no-store');
});

test('no user, a user without email, an auth error, or an unknown role all redirect', async () => {
  const cases = [
    client(null),
    client({ id: '1', app_metadata: { app_role: 'admin' } }),
    client(null, { message: 'jwt expired' }),
    client({ id: '1', email: 'a@b.c', app_metadata: { app_role: 'owner' } }),
    client({ id: '1', email: 'a@b.c', app_metadata: {} }),
  ];
  for (const createClient of cases) {
    const result = await staffGate(request(), { env, createClient });
    assert.equal(result.pass, false);
    assert.equal(result.response.status, 307);
  }
});

test('a staff user passes; the client reads the request cookies; refreshed cookies come back as Set-Cookie', async () => {
  const refreshed = [
    {
      name: 'sb-a',
      value: 'fresh',
      options: { maxAge: 100, httpOnly: true, sameSite: 'lax', path: '/' },
    },
  ];
  const result = await staffGate(request(), {
    env,
    createClient: client(
      { id: '1', email: 'a@b.c', app_metadata: { app_role: 'research' } },
      null,
      refreshed,
    ),
  });
  assert.equal(result.pass, true);
  assert.equal(result.setCookies.length, 1);
  assert.match(result.setCookies[0], /^sb-a=fresh; Path=\/; HttpOnly; SameSite=Lax; Max-Age=100$/);
  assert.deepEqual(client.seen.cookies, [
    { name: 'sb-a', value: '1' },
    { name: 'sb-b', value: 'two words' },
  ]);
  assert.equal(client.seen.url, 'https://x.supabase.co');
});

test('sign-in redirect for the sign-in path itself carries no next parameter', async () => {
  const result = await staffGate(
    { pathname: '/admin/login', search: '', headers: {} },
    { env: {}, createClient: () => assert.fail('x') },
  );
  assert.equal(result.pass, true, 'the sign-in page is never gated');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { runEdge, decorate, readRequestFacts } = require('../../server/edge/pipeline.cjs');

const facts = (over = {}) => ({
  method: 'GET',
  pathname: '/methodology',
  search: '',
  searchParams: new URLSearchParams(),
  headers: {},
  cookies: {},
  ...over,
});
const on = { enabled: true, bypassToken: 'sekret', retryAfterSeconds: 60 };
const off = { enabled: false, bypassToken: '', retryAfterSeconds: 60 };

test('readRequestFacts normalizes a Node request and reports a malformed one', () => {
  const f = readRequestFacts({
    method: 'GET',
    url: '/%72ecords?era=1930s&x=%20y',
    headers: { cookie: 'a=1; b=two%20words', 'user-agent': 'UA' },
  });
  assert.equal(f.ok, true);
  assert.equal(f.pathname, '/records');
  assert.equal(f.search, '?era=1930s&x=%20y');
  assert.equal(f.searchParams.get('x'), ' y');
  assert.deepEqual(f.cookies, { a: '1', b: 'two words' });
  assert.deepEqual(readRequestFacts({ method: 'GET', url: '/%zz', headers: {} }), { ok: false });
  assert.deepEqual(readRequestFacts({ method: 'GET', url: undefined, headers: {} }), { ok: false });
});

test('an oversize body to a public route is refused before the app sees it', async () => {
  const edge = await runEdge(
    facts({
      method: 'POST',
      headers: { 'content-length': '70000', 'content-type': 'application/json' },
    }),
    { nonce: 'N', deps: { maintenanceSettings: off } },
  );
  assert.equal(edge.response.status, 413);
});

test('maintenance answers before the crawler deny and the staff gate', async () => {
  const edge = await runEdge(facts({ pathname: '/admin', headers: { 'user-agent': 'GPTBot' } }), {
    nonce: 'N',
    deps: { maintenanceSettings: on, createSupabaseClient: () => assert.fail('gate must not run') },
  });
  assert.equal(edge.response.status, 503);
});

test('the crawler deny answers before the staff gate and only when maintenance is off', async () => {
  const edge = await runEdge(facts({ pathname: '/records', headers: { 'user-agent': 'GPTBot' } }), {
    nonce: 'N',
    deps: { maintenanceSettings: off },
  });
  assert.equal(edge.response.status, 403);
});

test('/admin and /design-system go through the staff gate; everything else passes through', async () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
  };
  const redirect = await runEdge(facts({ pathname: '/design-system' }), {
    env: {},
    nonce: 'N',
    deps: { maintenanceSettings: off },
  });
  assert.equal(redirect.response.status, 307);
  const staff = {
    auth: {
      getUser: async () => ({
        data: { user: { email: 'a@b.c', app_metadata: { app_role: 'admin' } } },
        error: null,
      }),
    },
  };
  const pass = await runEdge(facts({ pathname: '/admin/cases' }), {
    env,
    nonce: 'N',
    deps: { maintenanceSettings: off, createSupabaseClient: () => staff },
  });
  assert.equal(pass.response, null);
  const open = await runEdge(facts(), { nonce: 'N', deps: { maintenanceSettings: off } });
  assert.equal(open.response, null);
  assert.deepEqual(open.setCookies, []);
});

test('every outcome carries the security headers with this request nonce; admin adds the auth origin', async () => {
  const nonceOf = (edge) => /'nonce-([^']+)'/.exec(edge.securityHeaders[0].value)?.[1];
  const walled = await runEdge(facts(), { nonce: 'ONE', deps: { maintenanceSettings: on } });
  const open = await runEdge(facts(), { nonce: 'TWO', deps: { maintenanceSettings: off } });
  assert.equal(nonceOf(walled), 'ONE');
  assert.equal(nonceOf(open), 'TWO');
  const admin = await runEdge(facts({ pathname: '/admin/login' }), {
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' },
    nonce: 'N',
    deps: { maintenanceSettings: off },
  });
  const connect = admin.securityHeaders[0].value
    .split('; ')
    .find((d) => d.startsWith('connect-src'));
  assert.match(connect, /https:\/\/abc\.supabase\.co/);
  const publicPage = await runEdge(facts(), {
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' },
    nonce: 'N',
    deps: { maintenanceSettings: off },
  });
  assert.doesNotMatch(
    publicPage.securityHeaders[0].value,
    /abc\.supabase\.co/,
    'public pages never get the auth origin',
  );
});

test('decorate: CDN cache header only for cacheable documents with a non-error status', () => {
  assert.deepEqual(decorate(facts(), 200), {
    'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
  });
  assert.deepEqual(decorate(facts(), 404), {});
  assert.deepEqual(decorate(facts(), 503), {});
  assert.deepEqual(decorate(facts({ pathname: '/admin' }), 200), {});
  assert.deepEqual(decorate(facts({ method: 'POST' }), 200), {});
});

test('query canonicalization runs on public routes only, after the size limit', async () => {
  const run = (over) => runEdge(facts(over), { nonce: 'N', deps: { maintenanceSettings: off } });
  const messy = await run({
    pathname: '/methodology',
    search: '?x=1',
    searchParams: new URLSearchParams('x=1'),
  });
  assert.equal(messy.response.status, 308);
  assert.equal(messy.response.headers.location, '/methodology');
  const endpoint = await run({
    pathname: '/search/api',
    search: '?x=1',
    searchParams: new URLSearchParams('x=1'),
  });
  assert.equal(endpoint.response, null, 'an endpoint contract is its query string');
  const slash = await run({ pathname: '/methodology', trailingSlash: true });
  assert.equal(slash.response.status, 308);
  const clean = await run({
    pathname: '/records',
    search: '?kind=person',
    searchParams: new URLSearchParams('kind=person'),
  });
  assert.equal(clean.response, null);
  const big = await run({
    method: 'POST',
    pathname: '/methodology',
    search: '?x=1',
    searchParams: new URLSearchParams('x=1'),
    headers: { 'content-length': '70000' },
  });
  assert.equal(big.response.status, 413, 'the size limit answers before canonicalization');
});

test('loader data requests are gated as their route but never canonicalized to HTML', async () => {
  const run = (over) => runEdge(facts(over), { nonce: 'N', deps: { maintenanceSettings: off } });
  const loader = await run({
    pathname: '/records',
    isLoader: true,
    search: '?kind=PERSON',
    searchParams: new URLSearchParams('kind=PERSON'),
  });
  assert.equal(loader.response, null);
  const page = await run({
    pathname: '/records',
    search: '?kind=PERSON',
    searchParams: new URLSearchParams('kind=PERSON'),
  });
  assert.equal(page.response.status, 308);
  const staff = await run({ pathname: '/admin/cases', isLoader: true });
  assert.equal(staff.response.status, 307, 'the staff gate still sees the effective route');
});

test('eligibility follows the path as sent: /place/ redirects away, /placement does not', async () => {
  const run = (over) => runEdge(facts(over), { nonce: 'N', deps: { maintenanceSettings: off } });
  const slashPrefix = await run({ pathname: '/place', trailingSlash: true });
  assert.equal(slashPrefix.response.status, 308);
  assert.equal(slashPrefix.response.headers.location, '/place');
  assert.equal((await run({ pathname: '/placement', trailingSlash: true })).response, null);
  const bigSlash = await run({
    method: 'POST',
    pathname: '/place',
    trailingSlash: true,
    headers: { 'content-length': '70000' },
  });
  assert.equal(bigSlash.response.status, 413, 'the size limit covers the same set');
});

/**
 * The edge pipeline through the real server (needs `npm run export`): maintenance wall and bypass,
 * crawler deny, staff gate, security headers and the CDN cache header on rendered documents.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '../..');
const built = existsSync(join(ROOT, 'dist/server'));
let server;
let base;

const ENV_KEYS = [
  'MAINTENANCE_MODE',
  'MAINTENANCE_BYPASS_TOKEN',
  'MAINTENANCE_RETRY_AFTER_SECONDS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
];
test.before(async () => {
  if (!built) return;
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.SITE_ROOT = ROOT;
  ({ server } = require('../../server/entry.cjs'));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});
test.after(() => server?.close());

const get = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init });
const skip = { skip: !built };

test(
  'every rendered response carries the eight security headers and the CDN cache header',
  skip,
  async () => {
    const response = await get('/methodology');
    assert.equal(response.status, 200);
    for (const header of [
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
      'x-dns-prefetch-control',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy',
    ]) {
      assert.ok(response.headers.get(header), header);
    }
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(
      response.headers.get('vercel-cdn-cache-control'),
      'public, s-maxage=300, stale-while-revalidate=3600',
    );
    assert.match(
      response.headers.get('content-security-policy'),
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
  },
);

test(
  'an unknown route is a 404 that is not cached and still has security headers',
  skip,
  async () => {
    const response = await get('/this-route-does-not-exist');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('vercel-cdn-cache-control'), null);
    assert.ok(response.headers.get('content-security-policy'));
  },
);

test('maintenance mode walls pages with a 503, but not build output', skip, async () => {
  process.env.MAINTENANCE_MODE = '1';
  process.env.MAINTENANCE_BYPASS_TOKEN = 'sekret';
  const page = await get('/methodology');
  assert.equal(page.status, 503);
  assert.equal(page.headers.get('retry-after'), '86400');
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await page.text(), /closed for maintenance/);
  assert.ok(
    page.headers.get('content-security-policy'),
    'the wall carries the security headers too',
  );

  const js = readdirSync(join(ROOT, 'dist/client/_expo/static/js/web')).find((f) =>
    f.endsWith('.js'),
  );
  const asset = await get(`/_expo/static/js/web/${js}`);
  assert.equal(
    asset.status,
    200,
    'static build output stays reachable so a bypassed operator gets a working site',
  );
});

test(
  'the bypass token is redeemed once, then the cookie carries the operator through',
  skip,
  async () => {
    process.env.MAINTENANCE_MODE = '1';
    process.env.MAINTENANCE_BYPASS_TOKEN = 'sekret';
    const redeem = await get('/methodology?maintenance_bypass=sekret');
    assert.equal(redeem.status, 307);
    assert.equal(redeem.headers.get('location'), '/methodology');
    const cookies = redeem.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const through = await get('/methodology', { headers: { cookie } });
    assert.equal(through.status, 200);
    const header = await get('/methodology', { headers: { 'x-maintenance-bypass': 'sekret' } });
    assert.equal(header.status, 200);
    const wrong = await get('/methodology?maintenance_bypass=nope');
    assert.equal(wrong.status, 503);
  },
);

test(
  'AI crawlers are refused on expensive paths and welcome elsewhere; search crawlers are never refused',
  skip,
  async () => {
    const gpt = { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.1)' } };
    const refused = await get('/records', gpt);
    assert.equal(refused.status, 403);
    assert.equal(refused.headers.get('x-robots-tag'), 'noindex');
    assert.equal(refused.headers.get('cache-control'), 'private, no-store');
    assert.equal((await get('/methodology', gpt)).status, 200);
    const googlebot = await get('/records', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    });
    assert.notEqual(googlebot.status, 403);
  },
);

test(
  '/admin and /design-system send an anonymous visitor to sign-in, with the target remembered',
  skip,
  async () => {
    const admin = await get('/admin/cases?tab=open');
    assert.equal(admin.status, 307);
    assert.equal(admin.headers.get('location'), '/admin/login?next=%2Fadmin%2Fcases%3Ftab%3Dopen');
    assert.equal(admin.headers.get('cache-control'), 'private, no-store');
    const system = await get('/design-system');
    assert.equal(system.status, 307);
    assert.match(system.headers.get('location'), /^\/admin\/login\?next=/);
    assert.ok(admin.headers.get('content-security-policy'));
  },
);

test('the sign-in page itself is not gated (it falls through to the app)', skip, async () => {
  const response = await get('/admin/login');
  assert.notEqual(response.status, 307);
});

test('a malformed request target is a 400, and the server keeps serving', skip, async () => {
  const { request } = require('node:http');
  const raw = (target) =>
    new Promise((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port: server.address().port, path: target, method: 'GET' },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        },
      );
      req.on('error', reject);
      req.end();
    });
  assert.equal(await raw('/%zz'), 400);
  assert.equal(await raw('/a%2fb'), 400);
  assert.equal((await get('/methodology')).status, 200);
});

test(
  'encoded, cased and loader-data routes to staff pages are gated like the pages themselves',
  skip,
  async () => {
    for (const path of [
      '/%61dmin',
      '/%41dmin/cases',
      '/ADMIN',
      '/admin/../admin/x',
      '/_expo/loaders/admin/cases',
      '/_expo/loaders/design-system',
    ]) {
      const response = await get(path);
      assert.equal(response.status, 307, path);
      assert.match(response.headers.get('location'), /^\/admin\/login/, path);
    }
  },
);

test('a doubled leading slash in the bypass redirect cannot leave the site', skip, async () => {
  process.env.MAINTENANCE_MODE = '1';
  process.env.MAINTENANCE_BYPASS_TOKEN = 'sekret';
  const { request } = require('node:http');
  const location = await new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path: '//attacker.example/x?maintenance_bypass=sekret',
        method: 'GET',
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location }));
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(location.status, 307);
  assert.equal(location.location, '/attacker.example/x');
});

test('an oversize body to a public route is a 413 before the app sees it', skip, async () => {
  const response = await get('/methodology', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'x'.repeat(70_000),
  });
  assert.equal(response.status, 413);
  assert.equal(await response.text(), 'Payload Too Large');
  assert.ok(response.headers.get('content-security-policy'));
  const small = await get('/methodology', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.notEqual(small.status, 413);
});

test(
  'the walled response, a gate redirect and an error all carry no stale framing and the security headers',
  skip,
  async () => {
    process.env.MAINTENANCE_MODE = '1';
    process.env.MAINTENANCE_BYPASS_TOKEN = 'sekret';
    const walled = await get('/methodology');
    assert.equal(walled.status, 503);
    const length = walled.headers.get('content-length');
    const text = await walled.text();
    if (length !== null) assert.equal(Number(length), Buffer.byteLength(text));
    assert.ok(walled.headers.get('x-content-type-options'));
  },
);

test(
  'cache-busting and tracking params are 308ed to the canonical URL; canonical ones are served',
  skip,
  async () => {
    const messy = await get('/methodology?utm_source=mail&x=1');
    assert.equal(messy.status, 308);
    assert.equal(messy.headers.get('location'), '/methodology');
    assert.equal(messy.headers.get('cache-control'), 'no-store');
    assert.equal(messy.headers.get('vercel-cdn-cache-control'), null);
    assert.ok(messy.headers.get('content-security-policy'));
    const slash = await get('/methodology/');
    assert.equal(slash.status, 308);
    assert.equal(slash.headers.get('location'), '/methodology');
    assert.equal((await get('/methodology')).status, 200);
  },
);

test('the redirect keeps platform params and never leaves the site', skip, async () => {
  const response = await get('/methodology?x=1&_vercel_share=tok');
  assert.equal(response.headers.get('location'), '/methodology?_vercel_share=tok');
  const { request } = require('node:http');
  const doubled = await new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port: server.address().port, path: '//methodology?x=1', method: 'GET' },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.headers.location));
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.match(doubled, /^\/[^/]/, 'one leading slash, so never protocol-relative');
});

test('/explore is not canonicalized yet and does not crash', skip, async () => {
  const response = await get('/explore?utm_source=x&junk=1');
  assert.notEqual(response.status, 308);
  assert.notEqual(response.status, 500);
});

test('a loader data request is never redirected to the HTML page', skip, async () => {
  const response = await get('/_expo/loaders/methodology?utm_source=x');
  assert.notEqual(response.status, 308);
});

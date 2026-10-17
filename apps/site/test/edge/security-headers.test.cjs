const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildContentSecurityPolicy,
  buildGlobalSecurityHeaders,
} = require('../../server/edge/security-headers.cjs');

const directive = (csp, name) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `) || d === name);

test('production CSP with a nonce: no unsafe-inline or unsafe-eval in script-src, strict-dynamic, upgrade', () => {
  const csp = buildContentSecurityPolicy({ nonce: 'N==', isDev: false });
  const script = directive(csp, 'script-src');
  assert.match(script, /^script-src 'self' 'nonce-N==' 'strict-dynamic' 'sha256-/);
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
  assert.ok(directive(csp, 'upgrade-insecure-requests'));
  assert.equal(directive(csp, 'default-src'), "default-src 'self'");
  assert.equal(directive(csp, 'frame-ancestors'), "frame-ancestors 'none'");
  assert.equal(directive(csp, 'object-src'), "object-src 'none'");
  assert.equal(directive(csp, 'style-src'), "style-src 'self' 'unsafe-inline'");
});

test('dev CSP adds eval and websockets and drops upgrade-insecure-requests', () => {
  const csp = buildContentSecurityPolicy({ nonce: 'N==', isDev: true });
  assert.match(directive(csp, 'script-src'), /'unsafe-eval'/);
  assert.match(directive(csp, 'connect-src'), /ws: wss:/);
  assert.equal(directive(csp, 'upgrade-insecure-requests'), undefined);
});

test('auth origin joins connect-src only when it is a clean https origin (loopback http only in dev)', () => {
  const connect = (authUrl, isDev) =>
    directive(buildContentSecurityPolicy({ nonce: 'N', isDev, authUrl }), 'connect-src');
  assert.match(
    connect('https://abc.supabase.co/auth/v1', false),
    /https:\/\/abc\.supabase\.co(?!\/)/,
  );
  for (const bad of [
    'http://abc.supabase.co',
    'https://user:pw@abc.supabase.co',
    'https://*.supabase.co',
    'https://abc.supabase.co/?x=1',
    'not a url',
    'http://localhost:54321',
  ]) {
    assert.doesNotMatch(connect(bad, false), /supabase|localhost/, bad);
  }
  assert.match(connect('http://localhost:54321', true), /http:\/\/localhost:54321/);
});

test('global headers: the eight the Next site sends', () => {
  const headers = buildGlobalSecurityHeaders({ nonce: 'N' });
  assert.deepEqual(
    headers.map((h) => h.key),
    [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'X-DNS-Prefetch-Control',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
    ],
  );
  const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
  assert.equal(byKey['X-Frame-Options'], 'DENY');
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff');
  assert.equal(byKey['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(byKey['Permissions-Policy'], /geolocation=\(self\)/);
  assert.match(byKey['Permissions-Policy'], /camera=\(\)/);
});

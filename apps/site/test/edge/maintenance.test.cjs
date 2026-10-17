const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../../server/edge/maintenance.cjs');

const settings = (over = {}) => ({
  enabled: true,
  bypassToken: 'sekret',
  retryAfterSeconds: 3600,
  ...over,
});
const facts = (over = {}) => ({
  pathname: '/records',
  bypassParam: null,
  bypassCookie: null,
  bypassHeader: null,
  ...over,
});
const request = (over = {}) => ({
  pathname: '/records',
  searchParams: new URLSearchParams(),
  headers: {},
  cookies: {},
  ...over,
});

test('readMaintenanceSettings parses flags, clamps retry-after, trims message', () => {
  assert.equal(m.readMaintenanceSettings({}).enabled, false);
  for (const on of ['1', 'true', 'ON', ' enabled '])
    assert.equal(m.readMaintenanceSettings({ MAINTENANCE_MODE: on }).enabled, true, on);
  assert.equal(m.readMaintenanceSettings({ MAINTENANCE_MODE: 'yes' }).enabled, false);
  assert.equal(m.readMaintenanceSettings({}).retryAfterSeconds, 86_400);
  assert.equal(
    m.readMaintenanceSettings({ MAINTENANCE_RETRY_AFTER_SECONDS: '-5' }).retryAfterSeconds,
    86_400,
  );
  assert.equal(
    m.readMaintenanceSettings({ MAINTENANCE_RETRY_AFTER_SECONDS: '99999999' }).retryAfterSeconds,
    604_800,
  );
  assert.equal(m.readMaintenanceSettings({ MAINTENANCE_MESSAGE: '  hi  ' }).message, 'hi');
});

test('decideMaintenance', () => {
  assert.equal(m.decideMaintenance(settings({ enabled: false }), facts()).kind, 'pass');
  assert.equal(
    m.decideMaintenance(settings(), facts({ pathname: '/_expo/static/js/web/entry.js' })).kind,
    'pass',
  );
  assert.equal(
    m.decideMaintenance(settings(), facts({ pathname: '/brand/lockup-dark.png' })).kind,
    'pass',
  );
  assert.equal(m.decideMaintenance(settings(), facts({ pathname: '/favicon.ico' })).kind, 'pass');
  assert.equal(
    m.decideMaintenance(settings(), facts({ pathname: '/_next/static/x.js' })).kind,
    'block',
    'Next paths are no longer exempt',
  );
  assert.equal(m.decideMaintenance(settings(), facts()).kind, 'block');
  assert.equal(
    m.decideMaintenance(settings({ bypassToken: '' }), facts({ bypassParam: '' })).kind,
    'block',
    'no token configured: nothing bypasses',
  );
  assert.equal(
    m.decideMaintenance(settings(), facts({ bypassParam: 'sekret' })).kind,
    'grant-bypass',
  );
  assert.equal(m.decideMaintenance(settings(), facts({ bypassCookie: 'sekret' })).kind, 'bypass');
  assert.equal(m.decideMaintenance(settings(), facts({ bypassHeader: 'sekret' })).kind, 'bypass');
  for (const wrong of ['sekre', 'sekretx', 'SEKRET', '']) {
    assert.equal(
      m.decideMaintenance(
        settings(),
        facts({ bypassParam: wrong, bypassCookie: wrong, bypassHeader: wrong }),
      ).kind,
      'block',
      JSON.stringify(wrong),
    );
  }
});

test('secretsMatch compares bytes, including multibyte text', () => {
  assert.equal(m.secretsMatch('abc', 'abc'), true);
  assert.equal(m.secretsMatch('abc', 'abd'), false);
  assert.equal(m.secretsMatch('abc', 'ab'), false);
  assert.equal(m.secretsMatch('é', 'é'), true);
});

test('a walled request gets a 503 that tells crawlers to back off and caches nothing', () => {
  const response = m.handleMaintenance(request(), settings({ message: '<b>down</b> & out' }));
  assert.equal(response.status, 503);
  assert.equal(response.headers['retry-after'], '3600');
  assert.equal(response.headers['cache-control'], 'no-store, must-revalidate');
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(response.headers.vary, 'Cookie');
  assert.match(response.headers['content-type'], /text\/html/);
  assert.match(response.body, /&lt;b&gt;down&lt;\/b&gt; &amp; out/);
  assert.doesNotMatch(response.body, /<b>down/);
  assert.match(response.body, /Check again within the hour\./);
});

test('retry window wording stays vague at the top end', () => {
  assert.equal(m.describeRetryWindow(60), 'within the hour');
  assert.equal(m.describeRetryWindow(3601), 'later today');
  assert.equal(m.describeRetryWindow(86_401), 'in a few days');
});

test('redeeming the bypass param redirects without it, keeps other params, sets both cookies', () => {
  const response = m.handleMaintenance(
    request({
      pathname: '/records',
      searchParams: new URLSearchParams('maintenance_bypass=sekret&era=1930s'),
    }),
    settings(),
  );
  assert.equal(response.status, 307);
  assert.equal(response.headers.location, '/records?era=1930s');
  assert.equal(response.headers['cache-control'], 'no-store');
  const [bypass, hint] = response.setCookies;
  assert.match(bypass, /^bs_maint_bypass=sekret; Path=\/; HttpOnly;/);
  assert.match(bypass, /SameSite=Lax; Max-Age=2592000$/);
  assert.match(hint, /^bs_maint_bypass_hint=1; Path=\/; SameSite=Lax/);
  assert.doesNotMatch(hint, /HttpOnly/, 'the hint cookie is readable by the page');
});

test('bypass by cookie or header lets the request through; the wall is off when disabled', () => {
  assert.equal(
    m.handleMaintenance(request({ cookies: { bs_maint_bypass: 'sekret' } }), settings()),
    null,
  );
  assert.equal(
    m.handleMaintenance(request({ headers: { 'x-maintenance-bypass': 'sekret' } }), settings()),
    null,
  );
  assert.equal(m.handleMaintenance(request(), settings({ enabled: false })), null);
});

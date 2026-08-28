/**
 * Maintenance-mode tests.
 *
 * The wall's failure modes are asymmetric, so the assertions are too. Failing to raise it costs
 * money; raising it by accident, or leaving no way through it, costs the site. Both directions
 * are covered here, along with the two details that are easy to get subtly wrong: the fail-open
 * flag parse and the bypass-token comparison.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  decideMaintenance,
  isMaintenanceExemptPath,
  readMaintenanceSettings,
  secretsMatch,
  type MaintenanceSettings,
} from './maintenance-policy';
import { describeRetryWindow, escapeHtml, renderMaintenancePage } from './maintenance-page';
import {
  MAINTENANCE_BYPASS_HINT_COOKIE,
  MAINTENANCE_BYPASS_HINT_VALUE,
  hasMaintenanceBypassHint,
  readCookieValue,
} from './maintenance-bypass-hint';
import { isSecurityNormalizedPath } from '../../proxy';

const WALLED: MaintenanceSettings = {
  enabled: true,
  bypassToken: 'correct-horse-battery-staple',
  retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS,
};

function facts(overrides: Partial<Parameters<typeof decideMaintenance>[1]> = {}) {
  return {
    pathname: '/',
    bypassParam: null,
    bypassCookie: null,
    bypassHeader: null,
    ...overrides,
  };
}

test('the flag fails open: only an explicit affirmative raises the wall', () => {
  for (const raw of [undefined, '', ' ', '0', 'false', 'off', 'no', 'maybe', 'enable']) {
    assert.equal(
      readMaintenanceSettings({ MAINTENANCE_MODE: raw }).enabled,
      false,
      `expected ${JSON.stringify(raw)} to leave the site up`,
    );
  }
  for (const raw of ['1', 'true', 'TRUE', ' on ', 'Enabled']) {
    assert.equal(
      readMaintenanceSettings({ MAINTENANCE_MODE: raw }).enabled,
      true,
      `expected ${JSON.stringify(raw)} to raise the wall`,
    );
  }
});

test('retry-after falls back to a day and is capped at a week', () => {
  assert.equal(readMaintenanceSettings({}).retryAfterSeconds, DEFAULT_RETRY_AFTER_SECONDS);
  assert.equal(
    readMaintenanceSettings({ MAINTENANCE_RETRY_AFTER_SECONDS: 'soon' }).retryAfterSeconds,
    DEFAULT_RETRY_AFTER_SECONDS,
  );
  assert.equal(
    readMaintenanceSettings({ MAINTENANCE_RETRY_AFTER_SECONDS: '-5' }).retryAfterSeconds,
    DEFAULT_RETRY_AFTER_SECONDS,
  );
  assert.equal(
    readMaintenanceSettings({ MAINTENANCE_RETRY_AFTER_SECONDS: '600' }).retryAfterSeconds,
    600,
  );
  assert.equal(
    readMaintenanceSettings({ MAINTENANCE_RETRY_AFTER_SECONDS: '99999999' }).retryAfterSeconds,
    60 * 60 * 24 * 7,
  );
});

test('wall down passes every path through untouched', () => {
  const open: MaintenanceSettings = { ...WALLED, enabled: false };
  for (const pathname of ['/', '/entity/abc', '/robots.txt', '/api/anything']) {
    assert.deepEqual(decideMaintenance(open, facts({ pathname })), { kind: 'pass' });
  }
});

test('wall up blocks the public surface, robots.txt and sitemap.xml included', () => {
  for (const pathname of [
    '/',
    '/entity/abc',
    '/search',
    '/robots.txt',
    '/sitemap.xml',
    '/stories/x',
  ]) {
    assert.deepEqual(
      decideMaintenance(WALLED, facts({ pathname })),
      { kind: 'block' },
      `expected ${pathname} to be walled`,
    );
  }
});

test('build output and brand art stay reachable behind the wall', () => {
  for (const pathname of [
    '/_next/static/chunks/main.js',
    '/_next/image',
    '/brand/lockup-light.png',
    '/favicon.ico',
  ]) {
    assert.equal(isMaintenanceExemptPath(pathname), true, `${pathname} should be exempt`);
    assert.deepEqual(decideMaintenance(WALLED, facts({ pathname })), { kind: 'pass' });
  }
  // A path that merely mentions the prefix later on is not exempt.
  assert.equal(isMaintenanceExemptPath('/entity/brand/x'), false);
});

test('a valid token in the query is exchanged for a cookie, not accepted in place', () => {
  assert.deepEqual(decideMaintenance(WALLED, facts({ bypassParam: WALLED.bypassToken })), {
    kind: 'grant-bypass',
  });
});

test('cookie and header bypasses pass through', () => {
  assert.deepEqual(decideMaintenance(WALLED, facts({ bypassCookie: WALLED.bypassToken })), {
    kind: 'bypass',
  });
  assert.deepEqual(decideMaintenance(WALLED, facts({ bypassHeader: WALLED.bypassToken })), {
    kind: 'bypass',
  });
});

test('wrong, truncated, and extended tokens are all blocked', () => {
  for (const candidate of [
    '',
    'wrong',
    'correct-horse-battery-stapl',
    'correct-horse-battery-staple!',
  ]) {
    assert.deepEqual(
      decideMaintenance(WALLED, facts({ bypassCookie: candidate })),
      { kind: 'block' },
      `expected ${JSON.stringify(candidate)} to be rejected`,
    );
  }
});

test('an unconfigured bypass token cannot be matched by an empty credential', () => {
  const noToken: MaintenanceSettings = { ...WALLED, bypassToken: '' };
  assert.deepEqual(decideMaintenance(noToken, facts({ bypassCookie: '' })), { kind: 'block' });
  assert.deepEqual(decideMaintenance(noToken, facts({ bypassParam: '' })), { kind: 'block' });
  assert.deepEqual(decideMaintenance(noToken, facts({ bypassHeader: '' })), { kind: 'block' });
});

test('secretsMatch is exact', () => {
  assert.equal(secretsMatch('abc', 'abc'), true);
  assert.equal(secretsMatch('abc', 'abd'), false);
  assert.equal(secretsMatch('ab', 'abc'), false);
  assert.equal(secretsMatch('abcd', 'abc'), false);
  assert.equal(secretsMatch('', ''), true);
});

test('the page is self-contained: no external host, no script', () => {
  const html = renderMaintenancePage({ retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS });
  assert.match(html, /^<!doctype html>/);
  assert.equal(/<script/i.test(html), false, 'no script tag');
  assert.equal(/https?:\/\//i.test(html), false, 'no absolute URL to any host');
  assert.match(html, /src="\/brand\/lockup-light\.png"/);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /503/);
});

test('an operator message is escaped, not injected', () => {
  const html = renderMaintenancePage({
    message: '<img src=x onerror="alert(1)">',
    retryAfterSeconds: 3600,
  });
  assert.equal(html.includes('<img src=x'), false);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test('escapeHtml covers the five characters that matter', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('the return phrase never promises a specific hour', () => {
  assert.equal(describeRetryWindow(600), 'within the hour');
  assert.equal(describeRetryWindow(86_400), 'later today');
  assert.equal(describeRetryWindow(86_401), 'in a few days');
});

test('the security/normalization surface is unchanged by the widened matcher', () => {
  for (const pathname of [
    '/',
    '/search',
    '/entity/abc',
    '/place/abc',
    '/law',
    '/law/x',
    '/legal',
    '/legal/x',
    '/errata',
    '/errata/x',
    '/about',
    '/methodology',
    '/stories',
    '/stories/x',
    '/corrections',
    '/submit',
  ]) {
    assert.equal(isSecurityNormalizedPath(pathname), true, `${pathname} was matched before`);
  }
  for (const pathname of [
    '/history',
    '/history/api',
    '/submit/api',
    '/explore',
    '/explore/api',
    '/search/api',
    '/locate/api',
    '/corrections/status/abc',
    '/records',
    '/atlas',
  ]) {
    assert.equal(isSecurityNormalizedPath(pathname), false, `${pathname} was NOT matched before`);
  }
});

test('the bypass hint carries a constant, never the credential', () => {
  assert.equal(MAINTENANCE_BYPASS_HINT_VALUE, '1');
  assert.equal(MAINTENANCE_BYPASS_HINT_COOKIE.includes('token'), false);
});

test('readCookieValue picks the right cookie out of a header', () => {
  const header = `other=x; ${MAINTENANCE_BYPASS_HINT_COOKIE}=1; trailing=y`;
  assert.equal(readCookieValue(header, MAINTENANCE_BYPASS_HINT_COOKIE), '1');
  assert.equal(readCookieValue(header, 'missing'), null);
  // A cookie whose NAME merely ends with the target name must not match.
  assert.equal(
    readCookieValue(`not_${MAINTENANCE_BYPASS_HINT_COOKIE}=1`, MAINTENANCE_BYPASS_HINT_COOKIE),
    null,
  );
  assert.equal(readCookieValue('', MAINTENANCE_BYPASS_HINT_COOKIE), null);
});

test('the hint check is safe to call server-side', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(hasMaintenanceBypassHint(), false);
});

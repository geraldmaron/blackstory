/**
 * Web security module integration tests.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { THEME_BOOTSTRAP_SCRIPT } from '@repo/ui';
import { buildCsrfSetCookieHeader, generateCsrfToken, validateCsrfToken } from './csrf';
import { buildContentSecurityPolicy, THEME_BOOTSTRAP_SCRIPT_SHA256 } from './csp';
import { csrfCookieDefaults, secureCookieDefaults, serializeSetCookie } from './cookies';
import { buildSafeContentDisposition, sanitizeFilename } from './content-disposition';
import {
  assertRequestWithinLimit,
  REQUEST_SIZE_LIMITS,
  RequestTooLargeError,
} from './request-size-limits';
import {
  buildGlobalSecurityHeaders,
  mimeSniffingProtectionHeader,
  REFERRER_POLICY,
} from './security-headers';
import { createTrustedTypesPolicyStub, TRUSTED_TYPES_POLICY_NAME } from './trusted-types';
import { securityHeadersForNextConfig as securityHeadersFromMjs } from './next-config-headers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEXT_CONFIG_PATH = join(__dirname, '../../../next.config.mjs');

// Host allowances are asserted with plain containment rather than host-shaped regexes: the CSP
// is a header string, the question is whether a source is listed in it, and an unanchored
// hostname pattern reads as URL validation to a reader and to CodeQL alike
// (js/regex/missing-regexp-anchor).
// A stand-in for the base64 value proxy.ts actually generates (see generateNonce there); these
// tests only need a fixed, recognizable token to assert the directive shape around it.
const TEST_NONCE = 'dGVzdC1ub25jZS12YWx1ZQ==';

test('CSP includes strict defaults and frame-ancestors none', () => {
  const csp = buildContentSecurityPolicy({ isDev: false, nonce: TEST_NONCE });
  assert.match(csp, /default-src 'self'/);
  // repo-77nk: production script-src is nonce + strict-dynamic, not 'unsafe-inline'.
  assert.match(csp, new RegExp(`script-src 'self' 'nonce-${TEST_NONCE}' 'strict-dynamic'`));
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /worker-src 'self' blob:/);
  /*
   * Whole source expressions, not substrings.
   *
   * `csp.includes('archive.org')` also passes on a policy that only allowed `evil-archive.org`,
   * which is the opposite of what an allow-list assertion is for — and it is what CodeQL's
   * js/incomplete-url-substring-sanitization was pointing at. Splitting the policy on its own
   * delimiters and asking a Set for the exact source expression means the test fails if a host is
   * ever widened, shortened, or swapped for a lookalike.
   */
  const sources = new Set(csp.split(/[\s;]+/u).filter(Boolean));
  for (const source of [
    'https://demotiles.maplibre.org',
    'https://storage.googleapis.com',
    'https://twykhihqkcldpreuovay.supabase.co',
    // Banned-books covers: Open Library + archive.org redirect chain (see BOOK_COVER_IMG_SRC).
    'https://covers.openlibrary.org',
    'https://archive.org',
    'https://*.us.archive.org',
    'https://va.vercel-scripts.com',
    'https://vitals.vercel-insights.com',
  ]) {
    assert.ok(sources.has(source), `CSP must allow ${source} as a whole source expression`);
  }
});

test('THEME_BOOTSTRAP_SCRIPT_SHA256 matches the live theme-bootstrap script content', () => {
  // csp.ts hardcodes this hash (app/layout.tsx cannot call next/headers() for a nonce — see
  // that constant's own comment). If THEME_BOOTSTRAP_SCRIPT's source ever changes without also
  // updating the hash, browsers reject the script under CSP with no visible server-side error —
  // this test is what actually catches that drift.
  const digest = createHash('sha256').update(THEME_BOOTSTRAP_SCRIPT, 'utf8').digest('base64');
  assert.equal(THEME_BOOTSTRAP_SCRIPT_SHA256, `'sha256-${digest}'`);
});

test('production script-src allows the theme-bootstrap script by hash, with a nonce for everything else', () => {
  const csp = buildContentSecurityPolicy({ isDev: false, nonce: TEST_NONCE });
  const sources = new Set(csp.split(/[\s;]+/u).filter(Boolean));
  assert.ok(sources.has(THEME_BOOTSTRAP_SCRIPT_SHA256));
});

test('CSP falls back to unsafe-inline only when a caller has not migrated to the nonce pipeline', () => {
  // Every real response goes through proxy.ts, which always supplies a nonce. This fallback
  // exists only so an unmigrated caller fails safe (scripts still run) instead of silently
  // breaking — it must never be what production actually serves.
  const csp = buildContentSecurityPolicy({ isDev: false });
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*nonce-/);
  assert.doesNotMatch(csp, /script-src[^;]*strict-dynamic/);
});

test('CSP development relaxes script-src for Next.js hydration and HMR', () => {
  const csp = buildContentSecurityPolicy({ isDev: true, nonce: TEST_NONCE });
  // HMR still needs 'unsafe-eval'; hydration/flight scripts use the nonce, not 'unsafe-inline'.
  assert.match(csp, new RegExp(`script-src 'self' 'nonce-${TEST_NONCE}' 'strict-dynamic'`));
  assert.match(csp, /script-src[^;]*unsafe-eval/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.match(
    csp,
    /connect-src 'self' https:\/\/demotiles\.maplibre\.org https:\/\/tiles\.openfreemap\.org/,
  );
  assert.match(csp, /connect-src[^;]* ws: wss:/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test('CSP allows the USGS imagery host on both channels the raster basemap uses', () => {
  // MapLibre pulls raster tiles through the image pipeline, and through fetch on the WebGL path.
  // Missing either one fails as a silently blank satellite basemap, not as a visible error.
  const csp = buildContentSecurityPolicy();
  assert.match(csp, /img-src[^;]*https:\/\/basemap\.nationalmap\.gov/);
  assert.match(csp, /connect-src[^;]*https:\/\/basemap\.nationalmap\.gov/);
  // Not in font-src: this host serves imagery, and glyphs still come from OpenFreeMap only.
  assert.doesNotMatch(csp, /font-src[^;]*basemap\.nationalmap\.gov/);
});

test('global security headers include clickjacking and MIME sniffing protection', () => {
  const headers = buildGlobalSecurityHeaders({ nonce: TEST_NONCE });
  const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));
  assert.equal(map['X-Frame-Options'], 'DENY');
  assert.equal(map['X-Content-Type-Options'], 'nosniff');
  const csp = map['Content-Security-Policy'];
  assert.ok(csp);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, new RegExp(`script-src 'self' 'nonce-${TEST_NONCE}' 'strict-dynamic'`));
  assert.equal(map['Referrer-Policy'], REFERRER_POLICY);
  const permissions = map['Permissions-Policy'];
  assert.ok(permissions);
  assert.match(permissions, /camera=\(\)/);
  assert.equal(mimeSniffingProtectionHeader().value, 'nosniff');
});

test('next.config.mjs wires the static global security headers, with CSP deliberately absent', () => {
  // repo-77nk: CSP carries a per-request nonce, so it cannot be one of next.config.mjs's static
  // `/:path*` headers — it moves to proxy.ts instead (see proxy.test.ts).
  const source = readFileSync(NEXT_CONFIG_PATH, 'utf8');
  assert.match(source, /next-config-headers\.mjs/);
  assert.match(source, /globalSecurityHeaders/);
  assert.match(source, /source: '\/:path\*'/);

  const mjsHeaders = securityHeadersFromMjs();
  const mjsKeys = mjsHeaders.map((h: { key: string }) => h.key);
  assert.ok(
    !mjsKeys.includes('Content-Security-Policy'),
    'next.config.mjs must not emit a static (nonce-less) Content-Security-Policy header',
  );

  // Every other global header stays static, and still matches the edge-side (nonce-aware)
  // builder key-for-key.
  const tsKeys = buildGlobalSecurityHeaders({ nonce: TEST_NONCE })
    .map((h) => h.key)
    .filter((key) => key !== 'Content-Security-Policy');
  assert.deepEqual(mjsKeys.sort(), tsKeys.sort());
});

test('secure cookie defaults are HttpOnly with SameSite', () => {
  const defaults = secureCookieDefaults();
  assert.equal(defaults.httpOnly, true);
  assert.equal(defaults.sameSite, 'lax');
  const serialized = serializeSetCookie('session', 'abc', defaults);
  assert.match(serialized, /HttpOnly/);
  assert.match(serialized, /SameSite=Lax/);
});

test('csrf cookie uses __Host prefix defaults', () => {
  const defaults = csrfCookieDefaults();
  assert.equal(defaults.sameSite, 'strict');
  const header = buildCsrfSetCookieHeader('token123');
  assert.match(header, /^__Host-csrf=/);
  assert.match(header, /SameSite=Strict/);
});

test('CSRF validation uses double-submit timing-safe compare', () => {
  const token = generateCsrfToken();
  assert.equal(validateCsrfToken({ cookieToken: token, headerToken: token }), true);
  assert.equal(validateCsrfToken({ cookieToken: token, headerToken: `${token}x` }), false);
  assert.equal(validateCsrfToken({ cookieToken: token }), false);
});

test('request size limits reject oversized bodies', () => {
  const limit = REQUEST_SIZE_LIMITS.jsonBody;
  assert.throws(() => assertRequestWithinLimit(limit + 1, 'jsonBody'), RequestTooLargeError);
  assert.doesNotThrow(() => assertRequestWithinLimit(limit, 'jsonBody'));
});

test('content disposition sanitizes filenames and blocks traversal', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('report\r\n.pdf'), 'report.pdf');
  const header = buildSafeContentDisposition('My Report.pdf');
  assert.match(header, /^attachment;/);
  assert.match(header, /filename="My Report.pdf"/);
  assert.match(header, /filename\*=UTF-8''My%20Report\.pdf/);
});

test('trusted types stub exposes policy name', () => {
  const policy = createTrustedTypesPolicyStub();
  assert.equal(typeof policy.createHTML('x'), 'string');
  assert.equal(TRUSTED_TYPES_POLICY_NAME, 'blackBookDefault');
});

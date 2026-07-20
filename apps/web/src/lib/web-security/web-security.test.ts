/**
 * Web security module integration tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildCsrfSetCookieHeader, generateCsrfToken, validateCsrfToken } from './csrf';
import { buildContentSecurityPolicy } from './csp';
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

test('CSP includes strict defaults and frame-ancestors none', () => {
  const csp = buildContentSecurityPolicy({ isDev: false });
  assert.match(csp, /default-src 'self'/);
  // Next App Router needs inline flight scripts until a nonce pipeline lands.
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /worker-src 'self' blob:/);
  assert.match(csp, /demotiles\.maplibre\.org/);
  assert.match(csp, /storage\.googleapis\.com/);
  assert.match(csp, /recaptchaenterprise\.googleapis\.com/);
  assert.match(csp, /frame-src https:\/\/www\.google\.com\/recaptcha\//);
});

test('CSP development relaxes script-src for Next.js hydration and HMR', () => {
  const csp = buildContentSecurityPolicy({ isDev: true });
  assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(
    csp,
    /connect-src 'self' https:\/\/demotiles\.maplibre\.org https:\/\/tiles\.openfreemap\.org/,
  );
  assert.match(csp, /connect-src[^;]*recaptchaenterprise\.googleapis\.com/);
  assert.match(csp, /connect-src[^;]* ws: wss:/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test('global security headers include clickjacking and MIME sniffing protection', () => {
  const headers = buildGlobalSecurityHeaders();
  const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));
  assert.equal(map['X-Frame-Options'], 'DENY');
  assert.equal(map['X-Content-Type-Options'], 'nosniff');
  const csp = map['Content-Security-Policy'];
  assert.ok(csp);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(map['Referrer-Policy'], REFERRER_POLICY);
  const permissions = map['Permissions-Policy'];
  assert.ok(permissions);
  assert.match(permissions, /camera=\(\)/);
  assert.equal(mimeSniffingProtectionHeader().value, 'nosniff');
});

test('next.config.mjs wires global security headers', () => {
  const source = readFileSync(NEXT_CONFIG_PATH, 'utf8');
  assert.match(source, /next-config-headers\.mjs/);
  assert.match(source, /globalSecurityHeaders/);
  assert.match(source, /source: '\/:path\*'/);

  const mjsHeaders = securityHeadersFromMjs();
  const tsHeaders = buildGlobalSecurityHeaders();
  assert.deepEqual(
    mjsHeaders.map((h: { key: string }) => h.key).sort(),
    tsHeaders.map((h) => h.key).sort(),
  );
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

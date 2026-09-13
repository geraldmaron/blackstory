/**
 * CSP nonce pipeline (repo-77nk): `proxy.ts` must issue a fresh per-request nonce, forward it to
 * the app as the `x-nonce` request header, and set a nonce-based `Content-Security-Policy` on
 * every response it returns — not only the narrower `isSecurityNormalizedPath` set.
 *
 * These exercise `proxy()` directly against a bare `NextRequest`, without a maintenance/admin
 * env configured, so requests take the ordinary pass-through path.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { CSP_NONCE_HEADER } from './lib/web-security/constants';

function requestFor(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'https://blackstory.app'));
}

test('proxy sets a nonce-based CSP with no unsafe-inline in script-src', async () => {
  const response = await proxy(requestFor('/'));
  const csp = response.headers.get('Content-Security-Policy');
  assert.ok(csp, 'proxy response must carry a Content-Security-Policy header');
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.match(csp, /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
});

test('proxy issues a different nonce per request', async () => {
  const first = await proxy(requestFor('/'));
  const second = await proxy(requestFor('/'));
  const nonceOf = (response: Awaited<ReturnType<typeof proxy>>) =>
    response.headers.get('Content-Security-Policy')?.match(/'nonce-([^']+)'/)?.[1];
  const firstNonce = nonceOf(first);
  const secondNonce = nonceOf(second);
  assert.ok(firstNonce);
  assert.ok(secondNonce);
  assert.notEqual(firstNonce, secondNonce);
});

test('proxy carries CSP on a path outside the security-normalized allowlist too', async () => {
  // isSecurityNormalizedPath() does not match this path — coverage must not depend on it now
  // that the static next.config.mjs CSP header is gone.
  const response = await proxy(requestFor('/history'));
  const csp = response.headers.get('Content-Security-Policy');
  assert.ok(csp, 'a route outside the security-normalized allowlist must still get CSP');
  assert.match(csp, /nonce-/);
});

test('proxy forwards the nonce as a request header the app can read via next/headers', async () => {
  // Server Components that carry a manual <script> needing the nonce (the JSON-LD components,
  // stories/[slug]/page.tsx) read this back with `headers()`. app/layout.tsx itself does not —
  // it is on the shell resilience test's no-`await` list, so its one manual script is allowed by
  // a content hash instead (THEME_BOOTSTRAP_SCRIPT_SHA256 in csp.ts).
  const request = requestFor('/');
  const response = await proxy(request);
  // proxy.ts mutates the live NextRequest's headers in place before any branch runs.
  const forwarded = request.headers.get(CSP_NONCE_HEADER);
  assert.ok(forwarded);
  const csp = response.headers.get('Content-Security-Policy');
  assert.match(csp ?? '', new RegExp(`nonce-${forwarded}`));
});

/**
 * Unit tests for App Check header fetch timeout and CSP allowlists for reCAPTCHA Enterprise.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchAppCheckHeaders } from './fetch-app-check-headers.ts';
import { buildContentSecurityPolicy } from '../web-security/csp.ts';

test('fetchAppCheckHeaders returns {} when App Check is undefined', async () => {
  assert.deepEqual(await fetchAppCheckHeaders(undefined), {});
});

test('fetchAppCheckHeaders times out instead of hanging when getToken never settles', async () => {
  const never = {} as import('firebase/app-check').AppCheck;
  const start = Date.now();
  const headers = await fetchAppCheckHeaders(
    never,
    50,
    () => new Promise(() => {}),
  );
  assert.deepEqual(headers, {});
  assert.ok(Date.now() - start >= 45);
});

test('production CSP allows Firebase App Check / reCAPTCHA Enterprise hosts', () => {
  const csp = buildContentSecurityPolicy({ isDev: false });
  assert.match(csp, /script-src[^;]*https:\/\/www\.google\.com\/recaptcha\//);
  assert.match(csp, /connect-src[^;]*recaptchaenterprise\.googleapis\.com/);
  assert.match(csp, /connect-src[^;]*firebaseappcheck\.googleapis\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/www\.google\.com\/recaptcha\//);
  assert.match(csp, /img-src[^;]*https:\/\/www\.gstatic\.com\/recaptcha\//);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CSRF_COOKIE_NAME } from '../../../lib/web-security/csrf';
import { GET } from './route';

const minted = 'a1'.repeat(32);

async function call(cookie?: string, extra: Record<string, string> = {}) {
  const response = GET(
    new Request('https://blackstory.test/api/request-integrity', {
      headers: { ...(cookie === undefined ? {} : { cookie }), ...extra },
    }),
  );
  const body = (await response.json()) as { token?: string };
  return { response, token: body.token, setCookie: response.headers.get('set-cookie') };
}

test('with no cookie it mints a token and sets the cookie with its usual attributes', async () => {
  const { response, token, setCookie } = await call();
  assert.match(token ?? '', /^[0-9a-f]{64}$/);
  assert.ok(setCookie?.startsWith(`${CSRF_COOKIE_NAME}=${token}; `));
  assert.match(setCookie ?? '', /HttpOnly/);
  assert.match(setCookie ?? '', /SameSite=Strict/);
  assert.match(setCookie ?? '', /Max-Age=3600/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('a cookie this route minted is returned as it is, and its lifetime is not renewed', async () => {
  const { response, token, setCookie } = await call(`other=1; ${CSRF_COOKIE_NAME}=${minted}`);
  assert.equal(token, minted);
  assert.equal(setCookie, null, 'no Set-Cookie, so the original expiry stands');
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('a cookie of any other shape is replaced by a fresh mint', async () => {
  for (const value of [
    '',
    'short',
    minted.toUpperCase(),
    `${minted}00`,
    minted.slice(2),
    `${minted.slice(0, 62)}zz`,
    `${minted.slice(0, 63)}%0A`,
  ]) {
    const { token, setCookie } = await call(`${CSRF_COOKIE_NAME}=${value}`);
    assert.match(token ?? '', /^[0-9a-f]{64}$/, `minted for ${JSON.stringify(value)}`);
    assert.notEqual(token, value);
    assert.ok(setCookie?.startsWith(`${CSRF_COOKIE_NAME}=${token}; `));
  }
});

test('a cross-site request gets neither a token nor the cookie it carries', async () => {
  const { response, token, setCookie } = await call(`${CSRF_COOKIE_NAME}=${minted}`, {
    'sec-fetch-site': 'cross-site',
  });
  assert.equal(response.status, 403);
  assert.equal(token, undefined);
  assert.equal(setCookie, null);
});

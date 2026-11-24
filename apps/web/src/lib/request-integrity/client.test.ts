import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { clearRequestIntegrityToken, postJsonWithRequestIntegrity } from './client';

const realFetch = globalThis.fetch;
let calls: { url: string; method: string; token: string | null }[];
let tokens: string[];
let answers: Response[];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refusal = (reason: string) => json(401, { error: 'request_integrity_required', reason });

beforeEach(() => {
  clearRequestIntegrityToken();
  calls = [];
  tokens = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  answers = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, token: new Headers(init?.headers).get('x-csrf-token') });
    if (url === '/api/request-integrity') return json(200, { token: tokens.shift() });
    return answers.shift() ?? json(500, {});
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const posts = () => calls.filter((call) => call.method === 'POST');
const mints = () => calls.filter((call) => call.url === '/api/request-integrity');

test('an accepted POST is sent once with the token', async () => {
  answers = [json(202, { accepted: true })];
  const response = await postJsonWithRequestIntegrity('/submit/api', { a: 1 });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(posts().length, 1);
  assert.equal(posts()[0]?.token, 'a'.repeat(64));
});

for (const reason of ['token_mismatch', 'missing_token']) {
  test(`the integrity refusal (${reason}) refetches the token and retries exactly once`, async () => {
    answers = [refusal(reason), json(202, { accepted: true })];
    const response = await postJsonWithRequestIntegrity('/submit/api', { a: 1 });
    assert.equal(response.status, 202);
    assert.equal(mints().length, 2);
    assert.deepEqual(
      posts().map((call) => call.token),
      ['a'.repeat(64), 'b'.repeat(64)],
    );
  });
}

test('a second refusal is returned, not retried again', async () => {
  answers = [refusal('token_mismatch'), refusal('token_mismatch'), json(202, {})];
  const response = await postJsonWithRequestIntegrity('/submit/api', { a: 1 });
  assert.equal(response.status, 401);
  assert.equal(posts().length, 2);
  assert.deepEqual(await response.json(), {
    error: 'request_integrity_required',
    reason: 'token_mismatch',
  });
});

test('no other answer is retried, including a 401 that is not the integrity refusal', async () => {
  for (const answer of [
    json(401, { error: 'unauthorized' }),
    new Response('nope', { status: 401 }),
    json(403, { error: 'request_integrity_required', reason: 'cross_site_request' }),
    json(400, { error: 'validation_failed', issues: [] }),
    json(429, {}),
    json(500, {}),
  ]) {
    calls = [];
    answers = [answer, json(202, {})];
    const response = await postJsonWithRequestIntegrity('/submit/api', { a: 1 });
    assert.equal(response.status, answer.status);
    assert.equal(posts().length, 1, `status ${answer.status} is not retried`);
  }
  assert.equal(mints().length, 0, 'the cached token was kept throughout');
});

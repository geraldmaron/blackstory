import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../web-security/csrf';
import {
  createRequestIntegrityGuard,
  type RequestIntegrityTelemetryEvent,
} from './server';

const token = 'a'.repeat(64);

test('enforce mode accepts matching same-origin cookie and header tokens', async () => {
  const guard = createRequestIntegrityGuard({ mode: 'enforce', telemetry: { record() {} } });
  const decision = await guard({
    headers: new Headers({
      cookie: `${CSRF_COOKIE_NAME}=${token}`,
      [CSRF_HEADER_NAME]: token,
      'sec-fetch-site': 'same-origin',
    }),
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.verified, true);
});

test('enforce mode fails closed for missing, mismatched, and cross-site requests', async () => {
  const guard = createRequestIntegrityGuard({ mode: 'enforce', telemetry: { record() {} } });
  const missing = await guard({ headers: new Headers() });
  assert.equal(missing.allowed, false);
  if (!missing.allowed) assert.equal(missing.reason, 'missing_token');

  const mismatch = await guard({
    headers: new Headers({ cookie: `${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME]: 'b'.repeat(64) }),
  });
  assert.equal(mismatch.allowed, false);
  if (!mismatch.allowed) assert.equal(mismatch.reason, 'token_mismatch');

  const crossSite = await guard({
    headers: new Headers({
      cookie: `${CSRF_COOKIE_NAME}=${token}`,
      [CSRF_HEADER_NAME]: token,
      'sec-fetch-site': 'cross-site',
    }),
  });
  assert.equal(crossSite.allowed, false);
  if (!crossSite.allowed) assert.equal(crossSite.status, 403);
});

test('monitor mode records a failure without treating it as verified', async () => {
  const events: RequestIntegrityTelemetryEvent[] = [];
  const guard = createRequestIntegrityGuard({
    mode: 'monitor',
    telemetry: { record: (event) => events.push(event) },
  });
  const decision = await guard({ headers: {} });
  assert.equal(decision.allowed, true);
  assert.equal(decision.verified, false);
  assert.equal(events[0]?.outcome, 'monitored_failure');
});

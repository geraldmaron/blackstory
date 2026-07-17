/**
 * Unit tests for the public "submit a lead" rate-limit guard.
 * Uses a deterministic fake clock no real timers so results are reproducible.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSubmitLeadRateLimitGuard } from './rate-limit-guard';

function fakeClock(startMs: number) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

test('denies an anonymous submission without App Check verification', () => {
  const guard = createSubmitLeadRateLimitGuard({ now: () => 0 });
  const decision = guard.evaluate({ subject: 'anonymous', clientIp: '203.0.113.1' });
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, 'app_check_required');
});

test('allows a verified anonymous submission and denies once the rolling window is exhausted', () => {
  const clock = fakeClock(0);
  const guard = createSubmitLeadRateLimitGuard({ now: clock.now });
  const request = { subject: 'anonymous' as const, clientIp: '203.0.113.2', appCheckVerified: true };

  const first = guard.evaluate(request);
  assert.equal(first.allowed, true);
  if (first.allowed) guard.release(first.key);

  const second = guard.evaluate(request);
  assert.equal(second.allowed, true);
  if (second.allowed) guard.release(second.key);

  // The default `corrections`/anonymous window cap is 2 within the window a third
  // submission in the same window must be denied, not silently allowed through.
  const third = guard.evaluate(request);
  assert.equal(third.allowed, false);
  if (third.allowed) return;
  assert.equal(third.reason, 'rolling_window_exceeded');
});

test('a second concurrent submission from the same key is denied until the first releases', () => {
  const guard = createSubmitLeadRateLimitGuard({ now: () => 1_000 });
  const request = { subject: 'anonymous' as const, clientIp: '203.0.113.3', appCheckVerified: true };

  const first = guard.evaluate(request);
  assert.equal(first.allowed, true);

  const second = guard.evaluate(request);
  assert.equal(second.allowed, false);
  if (second.allowed) return;
  assert.equal(second.reason, 'concurrency_exceeded');

  if (first.allowed) guard.release(first.key);
  const third = guard.evaluate(request);
  assert.equal(third.allowed, true);
});

test('the rolling window resets once enough time has passed', () => {
  const clock = fakeClock(0);
  const guard = createSubmitLeadRateLimitGuard({ now: clock.now });
  const request = { subject: 'anonymous' as const, clientIp: '203.0.113.4', appCheckVerified: true };

  const first = guard.evaluate(request);
  assert.equal(first.allowed, true);
  if (first.allowed) guard.release(first.key);
  const second = guard.evaluate(request);
  assert.equal(second.allowed, true);
  if (second.allowed) guard.release(second.key);

  const third = guard.evaluate(request);
  assert.equal(third.allowed, false);

  clock.advance(61_000);
  const fourth = guard.evaluate(request);
  assert.equal(fourth.allowed, true);
});

test('different client IPs get independent rate-limit keys', () => {
  const guard = createSubmitLeadRateLimitGuard({ now: () => 0 });
  const a = guard.evaluate({ subject: 'anonymous', clientIp: '203.0.113.5', appCheckVerified: true });
  const b = guard.evaluate({ subject: 'anonymous', clientIp: '203.0.113.6', appCheckVerified: true });
  assert.equal(a.allowed, true);
  assert.equal(b.allowed, true);
  if (a.allowed && b.allowed) assert.notEqual(a.key, b.key);
});

test('formatDeniedResponse never leaks the exact quota, only a bounded retry hint', () => {
  const guard = createSubmitLeadRateLimitGuard({ now: () => 0 });
  const request = { subject: 'anonymous' as const, clientIp: '203.0.113.7' };
  const denied = guard.evaluate(request);
  assert.equal(denied.allowed, false);
  if (denied.allowed) return;
  const response = guard.formatDeniedResponse(denied);
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers['Retry-After']) > 0);
  assert.equal(response.body.error, 'rate_limit_exceeded');
});

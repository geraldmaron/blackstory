/**
 * Unit tests for correction rate-limit guard reuse under the corrections endpoint class.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCorrectionRateLimitGuard } from './rate-limit-guard';

test('denies anonymous corrections without App Check verification', () => {
  const guard = createCorrectionRateLimitGuard({ now: () => 0 });
  const decision = guard.evaluate({ subject: 'anonymous', clientIp: '203.0.113.10' });
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, 'app_check_required');
});

test('allows only two verified anonymous corrections per rolling window', () => {
  const guard = createCorrectionRateLimitGuard({ now: () => 0 });
  const request = { subject: 'anonymous' as const, clientIp: '203.0.113.11', appCheckVerified: true };

  const first = guard.evaluate(request);
  assert.equal(first.allowed, true);
  if (first.allowed) guard.release(first.key);

  const second = guard.evaluate(request);
  assert.equal(second.allowed, true);
  if (second.allowed) guard.release(second.key);

  const third = guard.evaluate(request);
  assert.equal(third.allowed, false);
});

/**
 * Confirms the degraded-mode helpers are total (every reason has copy) and never construct
 * a "degraded" state without a reason.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEGRADED_MODE_COPY,
  degradedFor,
  NOT_DEGRADED,
  type ExploreDegradedReason,
} from './snapshot-mode';

const ALL_REASONS: readonly ExploreDegradedReason[] = [
  'refine_network_error',
  'refine_rate_limited',
  'refine_app_check_denied',
  'refine_invalid_query',
  'map_canvas_unavailable',
];

test('every degraded reason has non-alarmist copy that mentions the snapshot fallback', () => {
  for (const reason of ALL_REASONS) {
    const copy = DEGRADED_MODE_COPY[reason];
    assert.ok(copy && copy.length > 0);
    assert.doesNotMatch(copy, /error|fail(ed)?/i);
  }
});

test('degradedFor always carries its reason through', () => {
  for (const reason of ALL_REASONS) {
    const state = degradedFor(reason);
    assert.equal(state.degraded, true);
    if (state.degraded) assert.equal(state.reason, reason);
  }
});

test('NOT_DEGRADED is the stable non-degraded sentinel', () => {
  assert.deepEqual(NOT_DEGRADED, { degraded: false });
});

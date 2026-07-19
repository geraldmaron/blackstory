/**
 * Unit tests for scheduled-function timeout capping (ADR-018).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISCOVERY_SCHEDULES,
  SCHEDULED_FUNCTION_TIMEOUT_CAP_SEC,
  scheduledTimeoutSeconds,
} from './schedules.ts';

test('caps roster timeouts at 1800s', () => {
  assert.equal(scheduledTimeoutSeconds(900), 900);
  assert.equal(scheduledTimeoutSeconds(1_800), 1_800);
  assert.equal(scheduledTimeoutSeconds(3_600), SCHEDULED_FUNCTION_TIMEOUT_CAP_SEC);
});

test('all discovery schedules stay within the scheduled-function cap', () => {
  for (const job of DISCOVERY_SCHEDULES) {
    assert.ok(scheduledTimeoutSeconds(job.rosterTimeoutSec) <= SCHEDULED_FUNCTION_TIMEOUT_CAP_SEC);
  }
});

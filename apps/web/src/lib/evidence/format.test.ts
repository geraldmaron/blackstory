/**
 * Unit tests for BB-053 presentation string helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatIsoDate, humanizeToken } from './format';

test('humanizeToken title-cases snake_case tokens', () => {
  assert.equal(humanizeToken('reputable_secondary'), 'Reputable Secondary');
  assert.equal(humanizeToken('retracted'), 'Retracted');
});

test('formatIsoDate strips the time component from an ISO-8601 date-time', () => {
  assert.equal(formatIsoDate('2026-06-01T00:00:00.000Z'), '2026-06-01');
});

test('formatIsoDate returns the original value unchanged when there is no time component', () => {
  assert.equal(formatIsoDate('2026-06-01'), '2026-06-01');
});

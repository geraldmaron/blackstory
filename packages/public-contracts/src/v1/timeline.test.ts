import assert from 'node:assert/strict';
import { test } from 'node:test';
import { timelineEventV1Schema } from './timeline.js';

test('round-trips a dated timeline event with precision', () => {
  const input = {
    id: 'ent_dunbar_school_001_status_0',
    atLabel: '1916',
    at: '1916-01-01T00:00:00.000Z',
    datePrecision: 'year' as const,
    title: 'Status: Active',
    body: 'In effect from 1916 onward.',
  };
  assert.deepEqual(timelineEventV1Schema.parse(input), input);
});

test('accepts an undated entry (at absent, atLabel carries the honest "Undated" label)', () => {
  const input = { id: 'ev_1', atLabel: 'Undated', datePrecision: 'circa' as const, title: 'Founding', body: 'Date not precisely known.' };
  assert.deepEqual(timelineEventV1Schema.parse(input), input);
});

test('rejects an unknown datePrecision (adversarial: unknown enum value)', () => {
  assert.throws(() =>
    timelineEventV1Schema.parse({ id: 'ev_1', atLabel: 'x', datePrecision: 'century', title: 't', body: 'b' }),
  );
});

test('rejects a non-parseable `at` timestamp (adversarial: invalid date)', () => {
  assert.throws(() =>
    timelineEventV1Schema.parse({ id: 'ev_1', atLabel: 'x', at: 'not-a-date', datePrecision: 'year', title: 't', body: 'b' }),
  );
});

/**
 * Unit tests for graph decade-span derivation (union temporal sources).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGraphActiveSpans, deriveGraphDecadeBucketInput } from './decade-spans.js';
import { deriveActiveDecadeBuckets } from './decades.js';

test('deriveGraphActiveSpans unions eraBuckets, statusHistory, and kind_detail EDTF', () => {
  const input = deriveGraphDecadeBucketInput({
    entityId: 'ent-person-1',
    kind: 'person',
    eraBuckets: ['1960s'],
    statusHistory: [
      { status: 'active', validFrom: '1963-01-01', datePrecision: 'year', basisClaimIds: [] },
    ],
    kindDetail: { birth_edtf: '1929', death_edtf: '1968' },
  });
  assert.ok(input);
  const buckets = deriveActiveDecadeBuckets(input!, { stillActiveCutoff: '2026-07-01' });
  assert.ok(buckets.includes('1960s'));
  assert.ok(buckets.includes('1920s'));
});

test('deriveGraphActiveSpans expands active place-like open-ended statusHistory forward', () => {
  const input = deriveGraphDecadeBucketInput({
    entityId: 'ent-place-1',
    kind: 'place',
    statusHistory: [
      { status: 'active', validFrom: '1900-01-01', datePrecision: 'year', basisClaimIds: [] },
    ],
  });
  assert.ok(input);
  const buckets = deriveActiveDecadeBuckets(input!, { stillActiveCutoff: '2026-07-01' });
  assert.ok(buckets.includes('1900s'));
  assert.ok(buckets.includes('2020s'));
});

test('deriveGraphDecadeBucketInput returns undefined when no temporal signal exists', () => {
  const input = deriveGraphDecadeBucketInput({
    entityId: 'ent-undated',
    kind: 'place',
  });
  assert.equal(input, undefined);
});

test('deriveGraphActiveSpans includes event window spans', () => {
  const spans = deriveGraphActiveSpans({
    entityId: 'ent-event-1',
    kind: 'event',
    eventWindow: { startAt: '1963', endAt: '1965', datePrecision: 'year' },
  });
  assert.equal(spans.length, 1);
  assert.equal(spans[0]?.validFrom, '1963');
});

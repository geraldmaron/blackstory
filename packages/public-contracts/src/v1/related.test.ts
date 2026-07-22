import assert from 'node:assert/strict';
import { test } from 'node:test';
import { relatedEntryV1Schema, relatedNeighborV1Schema } from './related.js';

test('round-trips a related entry with an open-ended timespan (validTo: null)', () => {
  const input = { id: 'ent_15th_st_church_001', type: 'founded_in', direction: 'incoming' as const, timespan: { validFrom: '1870-01-01', validTo: null } };
  assert.deepEqual(relatedEntryV1Schema.parse(input), input);
});

test('round-trips a related neighbor', () => {
  const input = {
    id: 'ent_15th_st_church_001',
    displayName: 'Fifteenth Street Presbyterian Church',
    kind: 'institution',
    summary: "Hosted the school's founding class in its basement in 1870.",
    relationType: 'founded_in',
    direction: 'incoming' as const,
  };
  assert.deepEqual(relatedNeighborV1Schema.parse(input), input);
});

test('rejects an unknown direction (adversarial: unknown enum value)', () => {
  assert.throws(() => relatedEntryV1Schema.parse({ id: 'x', type: 'y', direction: 'sideways' }));
});

test('related entry / neighbor schemas are not recursive (no field of their own type) — structural check', () => {
  const entryShape = relatedEntryV1Schema.shape as Record<string, unknown>;
  const neighborShape = relatedNeighborV1Schema.shape as Record<string, unknown>;
  // Neither schema declares a field whose value is itself a related-entry/neighbor array or
  // object — this is the by-construction defense against recursive graph payloads (see the
  // module doc comment). Asserting the known, flat field list guards against a future edit
  // accidentally introducing one.
  assert.deepEqual(Object.keys(entryShape).sort(), ['direction', 'id', 'timespan', 'type']);
  assert.deepEqual(
    Object.keys(neighborShape).sort(),
    ['direction', 'displayName', 'id', 'kind', 'relationType', 'summary', 'timespan'],
  );
});

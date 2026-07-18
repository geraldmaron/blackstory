/**
 * Unit tests for bounded neighbor-id collection used by live entity hydration.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEARNING_CONTINUE_LEARNING_CAP,
  LEARNING_RELATED_DISPLAY_CAP,
} from '@blap/domain';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids';

test('collectOneHopNeighborIds prefers typed related and respects display cap', () => {
  const related = Array.from({ length: LEARNING_RELATED_DISPLAY_CAP + 5 }, (_, i) => ({
    id: `ent_${i}`,
    type: 'related_to' as const,
    direction: 'outgoing' as const,
  }));
  const ids = collectOneHopNeighborIds({ related });
  assert.equal(ids.length, LEARNING_RELATED_DISPLAY_CAP);
  assert.equal(ids[0], 'ent_0');
});

test('collectOneHopNeighborIds falls back to relatedIds', () => {
  const ids = collectOneHopNeighborIds({ relatedIds: ['a', 'b'] });
  assert.deepEqual(ids, ['a', 'b']);
});

test('collectTwoHopNeighborIds excludes self and one-hop and caps fan-out', () => {
  const oneHopIds = ['n1', 'n2'];
  const ids = collectTwoHopNeighborIds('self', oneHopIds, [
    {
      id: 'n1',
      related: [
        { id: 'self' },
        { id: 'n2' },
        { id: 't1' },
        { id: 't2' },
        { id: 't3' },
        { id: 't4' },
        { id: 't5' },
        { id: 't6' },
        { id: 't7' },
        { id: 't8' },
        { id: 't9' },
        { id: 't10' },
        { id: 't11' },
        { id: 't12' },
        { id: 't13' },
        { id: 't14' },
        { id: 't15' },
        { id: 't16' },
        { id: 't17' },
        { id: 't18' },
        { id: 't19' },
      ],
    },
  ]);
  assert.ok(!ids.includes('self'));
  assert.ok(!ids.includes('n1'));
  assert.ok(!ids.includes('n2'));
  assert.ok(ids.includes('t1'));
  assert.ok(ids.length <= LEARNING_CONTINUE_LEARNING_CAP * 3);
});

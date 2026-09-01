/**
 * Unit tests for bounded 1-hop / 2-hop neighbor id collection (api-public hydrate caps).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids.js';

test('collectOneHopNeighborIds prefers related edges over relatedIds', () => {
  const ids = collectOneHopNeighborIds({
    related: [{ id: 'ent_a' }, { id: 'ent_b' }],
    relatedIds: ['ent_legacy'],
  });
  assert.deepEqual(ids, ['ent_a', 'ent_b']);
});

test('collectTwoHopNeighborIds excludes self and one-hop ids', () => {
  const ids = collectTwoHopNeighborIds(
    'ent_root',
    ['ent_a'],
    [{ id: 'ent_a', related: [{ id: 'ent_root' }, { id: 'ent_a' }, { id: 'ent_c' }] }],
  );
  assert.deepEqual(ids, ['ent_c']);
});

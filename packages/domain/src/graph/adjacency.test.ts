/**
 * Tests for BB-092 acceptance criterion 3 (per-entity bounded adjacency) and acceptance
 * criterion 5 (public related-entry projection: {id, type, direction, timespan}).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EntityRelationship } from '../relationship.js';
import {
  buildAllEntityAdjacency,
  buildEntityAdjacency,
  DEFAULT_ADJACENCY_CAP,
  toPublicRelatedEntries,
} from './adjacency.js';

function rel(overrides: Partial<EntityRelationship> & Pick<EntityRelationship, 'id' | 'fromEntityId' | 'toEntityId' | 'type'>): EntityRelationship {
  return {
    evidenceIds: ['ev-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('buildEntityAdjacency includes both outgoing and incoming edges with correct direction', () => {
  const relationships = [
    rel({ id: 'r1', fromEntityId: 'a', toEntityId: 'b', type: 'founded' }),
    rel({ id: 'r2', fromEntityId: 'c', toEntityId: 'a', type: 'cites' }),
  ];
  const adjacency = buildEntityAdjacency('a', relationships);
  assert.equal(adjacency.entries.length, 2);
  const outgoing = adjacency.entries.find((e) => e.id === 'b');
  const incoming = adjacency.entries.find((e) => e.id === 'c');
  assert.equal(outgoing?.direction, 'outgoing');
  assert.equal(incoming?.direction, 'incoming');
});

test('buildEntityAdjacency orders by evidence count descending, then id/type/relationshipId', () => {
  const relationships = [
    rel({ id: 'r-low', fromEntityId: 'a', toEntityId: 'x', type: 'cites', evidenceIds: ['e1'] }),
    rel({
      id: 'r-high',
      fromEntityId: 'a',
      toEntityId: 'y',
      type: 'cites',
      evidenceIds: ['e1', 'e2', 'e3'],
    }),
  ];
  const adjacency = buildEntityAdjacency('a', relationships);
  assert.deepEqual(
    adjacency.entries.map((e) => e.id),
    ['y', 'x'],
  );
});

test('buildEntityAdjacency caps at the default top-N and reports totalCandidates uncapped', () => {
  const relationships = Array.from({ length: DEFAULT_ADJACENCY_CAP + 10 }, (_, i) =>
    rel({ id: `r${i}`, fromEntityId: 'a', toEntityId: `n${i}`, type: 'cites', evidenceIds: ['e1'] }),
  );
  const adjacency = buildEntityAdjacency('a', relationships);
  assert.equal(adjacency.entries.length, DEFAULT_ADJACENCY_CAP);
  assert.equal(adjacency.totalCandidates, DEFAULT_ADJACENCY_CAP + 10);
});

test('buildEntityAdjacency respects a custom cap', () => {
  const relationships = Array.from({ length: 5 }, (_, i) =>
    rel({ id: `r${i}`, fromEntityId: 'a', toEntityId: `n${i}`, type: 'cites' }),
  );
  const adjacency = buildEntityAdjacency('a', relationships, { cap: 2 });
  assert.equal(adjacency.entries.length, 2);
  assert.equal(adjacency.totalCandidates, 5);
});

test('buildEntityAdjacency skips self-loops', () => {
  const relationships = [rel({ id: 'r1', fromEntityId: 'a', toEntityId: 'a', type: 'related_to' })];
  const adjacency = buildEntityAdjacency('a', relationships);
  assert.equal(adjacency.entries.length, 0);
});

test('buildEntityAdjacency with a decade filter includes timeless edges and excludes non-overlapping ones', () => {
  const relationships = [
    rel({ id: 'r1', fromEntityId: 'a', toEntityId: 'b', type: 'attended', temporal: { validFrom: '1963' } }),
    rel({ id: 'r2', fromEntityId: 'a', toEntityId: 'c', type: 'attended', temporal: { validFrom: '1990' } }),
    rel({ id: 'r3', fromEntityId: 'a', toEntityId: 'd', type: 'cites' }), // timeless
  ];
  const adjacency = buildEntityAdjacency('a', relationships, { decade: '1960s' });
  assert.deepEqual(
    adjacency.entries.map((e) => e.id).sort(),
    ['b', 'd'],
  );
});

test('buildAllEntityAdjacency returns a deterministically (sorted) keyed map', () => {
  const relationships = [rel({ id: 'r1', fromEntityId: 'b', toEntityId: 'a', type: 'cites' })];
  const map = buildAllEntityAdjacency(['b', 'a'], relationships);
  assert.deepEqual([...map.keys()], ['a', 'b']);
});

test('toPublicRelatedEntries drops internal ranking fields, keeping exactly {id, type, direction, timespan}', () => {
  const relationships = [
    rel({
      id: 'r1',
      fromEntityId: 'a',
      toEntityId: 'b',
      type: 'attended',
      temporal: { validFrom: '1963' },
    }),
  ];
  const adjacency = buildEntityAdjacency('a', relationships);
  const publicEntries = toPublicRelatedEntries(adjacency);
  assert.deepEqual(publicEntries, [
    { id: 'b', type: 'attended', direction: 'outgoing', timespan: { validFrom: '1963' } },
  ]);
  for (const entry of publicEntries) {
    assert.ok(!('relationshipId' in entry));
    assert.ok(!('evidenceCount' in entry));
  }
});

test('re-running buildAllEntityAdjacency against identical input is deterministic', () => {
  const relationships = [
    rel({ id: 'r1', fromEntityId: 'a', toEntityId: 'b', type: 'cites', evidenceIds: ['e1'] }),
    rel({ id: 'r2', fromEntityId: 'a', toEntityId: 'c', type: 'cites', evidenceIds: ['e1', 'e2'] }),
  ];
  const first = buildAllEntityAdjacency(['a', 'b', 'c'], relationships);
  const second = buildAllEntityAdjacency(['a', 'b', 'c'], relationships);
  assert.deepEqual(first, second);
});

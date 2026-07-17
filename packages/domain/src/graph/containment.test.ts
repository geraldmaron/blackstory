/**
 * Tests for containment-chain materialization
 * (located_at/part_of: spot -> city -> county -> state resolved into a denormalized path
 * carrying jurisdiction ids), including cycle-safety and bounded-depth proofs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildContainmentIndex,
  createInMemoryJurisdictionParentLookup,
  extendJurisdictionChain,
  MAX_CONTAINMENT_DEPTH,
  resolveEntityContainmentPath,
  resolveEntityContainmentPaths,
  type ContainmentEdgeInput,
  type ContainmentEntityInput,
} from './containment.js';
import { GRAPH_GOLD_FIXTURES } from './fixtures.js';

test('resolveEntityContainmentPath walks spot -> city -> county -> state, collecting jurisdiction ids finest-first', () => {
  const { entities, relationships } = GRAPH_GOLD_FIXTURES.containmentChain;
  const index = buildContainmentIndex(relationships);
  const entitiesById = new Map(entities.map((e) => [e.entityId, e]));

  const path = resolveEntityContainmentPath('gg-place-spot', index, entitiesById);

  assert.deepEqual(
    path.chain.map((hop) => hop.entityId),
    ['gg-place-spot', 'gg-place-city', 'gg-place-county', 'gg-place-state'],
  );
  assert.deepEqual(path.jurisdictionIds, ['gg-jur-city', 'gg-jur-county', 'gg-jur-state']);
  assert.equal(path.cycleDetected, false);
  assert.equal(path.depthTruncated, false);
});

test('resolveEntityContainmentPaths resolves every geo-anchored entity deterministically (sorted input order)', () => {
  const { entities, relationships } = GRAPH_GOLD_FIXTURES.containmentChain;
  const ids = ['gg-place-city', 'gg-place-spot'];
  const paths = resolveEntityContainmentPaths(ids, entities, relationships);
  assert.deepEqual(
    paths.map((p) => p.entityId),
    ['gg-place-city', 'gg-place-spot'], // sorted
  );
});

test('a part_of cycle is detected and does not hang the build (cycle-safety proof)', () => {
  const { entities, relationships } = GRAPH_GOLD_FIXTURES.containmentCycle;
  const index = buildContainmentIndex(relationships);
  const entitiesById = new Map(entities.map((e) => [e.entityId, e]));

  const path = resolveEntityContainmentPath('gg-place-cycle-a', index, entitiesById);

  assert.equal(path.cycleDetected, true);
  // Traversal still terminates with a finite, small chain rather than looping forever.
  assert.ok(path.chain.length <= MAX_CONTAINMENT_DEPTH);
  assert.ok(path.chain.length >= 1);
});

test('bounded depth: a chain longer than MAX_CONTAINMENT_DEPTH is truncated, not infinite', () => {
  const relationships: ContainmentEdgeInput[] = [];
  const entities: ContainmentEntityInput[] = [];
  for (let i = 0; i < MAX_CONTAINMENT_DEPTH + 5; i += 1) {
    entities.push({ entityId: `hop-${i}`, jurisdictionIds: [`jur-${i}`] });
    relationships.push({ fromEntityId: `hop-${i}`, toEntityId: `hop-${i + 1}`, type: 'part_of' as const });
  }
  const index = buildContainmentIndex(relationships);
  const entitiesById = new Map(entities.map((e) => [e.entityId, e]));

  const path = resolveEntityContainmentPath('hop-0', index, entitiesById);

  assert.equal(path.depthTruncated, true);
  assert.equal(path.chain.length, MAX_CONTAINMENT_DEPTH);
});

test('re-running resolveEntityContainmentPaths against identical input is deterministic (re-runnable)', () => {
  const { entities, relationships } = GRAPH_GOLD_FIXTURES.containmentChain;
  const ids = ['gg-place-spot', 'gg-place-city'];
  const first = resolveEntityContainmentPaths(ids, entities, relationships);
  const second = resolveEntityContainmentPaths(ids, entities, relationships);
  assert.deepEqual(first, second);
});

test('extendJurisdictionChain walks the BB-091 jurisdiction parentId hierarchy, cycle-safe and deduplicated', async () => {
  const lookup = createInMemoryJurisdictionParentLookup([
    { id: 'us-city-x', parentId: 'us-county-x' },
    { id: 'us-county-x', parentId: 'us-06' },
    { id: 'us-06', parentId: 'us' },
  ]);
  const result = await extendJurisdictionChain(['us-city-x'], lookup);
  assert.deepEqual(result.jurisdictionIds, ['us-city-x', 'us-county-x', 'us-06', 'us']);
  assert.equal(result.cycleDetected, false);
  assert.equal(result.depthTruncated, false);
});

test('extendJurisdictionChain does not falsely flag a cycle when two starting ids share an ancestor', async () => {
  const lookup = createInMemoryJurisdictionParentLookup([
    { id: 'us-city-x', parentId: 'us-06' },
    { id: 'us-city-y', parentId: 'us-06' },
  ]);
  const result = await extendJurisdictionChain(['us-city-x', 'us-city-y'], lookup);
  assert.deepEqual(result.jurisdictionIds, ['us-city-x', 'us-06', 'us-city-y']);
  assert.equal(result.cycleDetected, false);
});

test('extendJurisdictionChain detects a genuine registry cycle and stops safely', async () => {
  const lookup = createInMemoryJurisdictionParentLookup([
    { id: 'jur-a', parentId: 'jur-b' },
    { id: 'jur-b', parentId: 'jur-a' },
  ]);
  const result = await extendJurisdictionChain(['jur-a'], lookup);
  assert.equal(result.cycleDetected, true);
  assert.deepEqual(result.jurisdictionIds, ['jur-a', 'jur-b']);
});

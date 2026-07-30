/**
 * Unit tests for hub merge remapping helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAbsorbedToSurvivorMap,
  DEFAULT_HUB_MERGE_PAIRS,
  planRelationshipRewrites,
  remapEntityId,
  rewriteRelationshipEndpoints,
} from './entity-hub-merge.ts';

const MAP = buildAbsorbedToSurvivorMap(DEFAULT_HUB_MERGE_PAIRS);

test('remapEntityId maps absorbed hub ids to survivors', () => {
  assert.equal(remapEntityId('ent_sncc_001', MAP), 'ent_sncc_org_001');
  assert.equal(remapEntityId('ent_sclc_001', MAP), 'ent_sclc_org_001');
  assert.equal(remapEntityId('ent_other_001', MAP), 'ent_other_001');
});

test('rewriteRelationshipEndpoints rewrites absorbed endpoints', () => {
  const rewritten = rewriteRelationshipEndpoints(
    [
      {
        id: 'rel-1',
        fromEntityId: 'ent_sncc_001',
        toEntityId: 'ent_place_1',
        relationshipType: 'related_to',
      },
      {
        id: 'rel-2',
        fromEntityId: 'ent_a',
        toEntityId: 'ent_sclc_001',
        relationshipType: 'located_at',
      },
    ],
    MAP,
  );
  assert.equal(rewritten[0]?.fromEntityId, 'ent_sncc_org_001');
  assert.equal(rewritten[1]?.toEntityId, 'ent_sclc_org_001');
});

test('planRelationshipRewrites drops self-loops and duplicate edges', () => {
  const plan = planRelationshipRewrites(
    [
      {
        id: 'rel-self',
        fromEntityId: 'ent_sncc_001',
        toEntityId: 'ent_sncc_org_001',
        relationshipType: 'related_to',
      },
      {
        id: 'rel-dup-b',
        fromEntityId: 'ent_sncc_001',
        toEntityId: 'ent_place_1',
        relationshipType: 'related_to',
      },
      {
        id: 'rel-dup-a',
        fromEntityId: 'ent_sncc_org_001',
        toEntityId: 'ent_place_1',
        relationshipType: 'related_to',
      },
    ],
    MAP,
  );
  assert.equal(plan.dropSelfLoop.length, 1);
  assert.equal(plan.dropDuplicate.length, 1);
  assert.equal(plan.keep.length, 1);
  assert.equal(plan.keep[0]?.id, 'rel-dup-a');
});

/**
 * Tests for hybrid fusion weights config (BB-072 AC5).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FUSION_WEIGHTS, FUSION_WEIGHTS_VERSION, fuseHybridLanes } from './fusion.js';
import type { SearchableEntityRecord } from './types.js';

function record(id: string): SearchableEntityRecord {
  return {
    id,
    kind: 'place',
    displayName: id,
    nameLower: id.toLowerCase(),
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
  };
}

test('fuseHybridLanes merges structured and vector lanes', () => {
  const fused = fuseHybridLanes({
    structuredRanked: [{ record: record('a'), matchedOn: 'displayName', matchedText: 'a' }],
    vectorMatches: [{ entityId: 'b', distance: 0.9 }],
  });
  assert.deepEqual(fused.fusedIds, ['a', 'b']);
  assert.equal(fused.weightsVersion, FUSION_WEIGHTS_VERSION);
});

test('fusion weights default to equal weighting', () => {
  const fused = fuseHybridLanes({
    structuredRanked: [{ record: record('a'), matchedOn: 'displayName', matchedText: 'a' }],
    vectorMatches: [{ entityId: 'a', distance: 0.9 }],
  });
  assert.deepEqual(fused.weights, DEFAULT_FUSION_WEIGHTS);
});

test('changing fusion weights changes merge order', () => {
  const structured = [
    { record: record('structured-first'), matchedOn: 'displayName' as const, matchedText: 'x' },
  ];
  const vector = [{ entityId: 'vector-first', distance: 0.95 }];
  const equal = fuseHybridLanes({ structuredRanked: structured, vectorMatches: vector });
  const vectorHeavy = fuseHybridLanes({
    structuredRanked: structured,
    vectorMatches: vector,
    weights: { structured: 0.5, vector: 2 },
  });
  assert.notDeepEqual(equal.fusedIds, vectorHeavy.fusedIds);
});

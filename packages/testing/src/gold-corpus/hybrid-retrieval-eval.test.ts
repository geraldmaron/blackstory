/**
 * Tests for hybrid retrieval eval harness (precision/recall/MRR gates).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS,
  loadHybridRetrievalQuerySet,
  runHybridRetrievalEval,
  type HybridRetrievalQuerySet,
} from './hybrid-retrieval-eval.js';

const MINI_QUERY_SET: HybridRetrievalQuerySet = {
  schemaVersion: 'hybrid-retrieval-queries.v1',
  querySetVersion: 'test-mini',
  description: 'mini fixture',
  queries: [
    {
      id: 'q1',
      text: 'alpha',
      category: 'name_lookup',
      relevantEntityIds: ['a', 'b'],
    },
    {
      id: 'q2',
      text: 'beta place',
      category: 'place_query',
      relevantEntityIds: ['c'],
      stateFilter: 'NC',
    },
  ],
};

test('runHybridRetrievalEval computes precision recall and MRR', async () => {
  const result = await runHybridRetrievalEval(MINI_QUERY_SET, ({ normalizedQuery }) => {
    if (normalizedQuery.includes('alpha')) return ['a', 'x', 'y', 'z', 'w'];
    return ['c', 'd'];
  });
  assert.equal(result.queryCount, 2);
  assert.ok(result.meanPrecisionAt5 > 0);
  assert.ok(result.meanRecallAt5 > 0);
  assert.ok(result.meanReciprocalRank > 0);
});

test('eval fails when metrics fall below thresholds', async () => {
  const result = await runHybridRetrievalEval(MINI_QUERY_SET, () => ['miss', 'miss', 'miss'], {
    thresholds: {
      minimumPrecisionAt5: 0.99,
      minimumRecallAt5: 0.99,
      minimumMeanReciprocalRank: 0.99,
    },
  });
  assert.equal(result.passed, false);
  assert.ok(result.failures.length >= 1);
});

test('default thresholds are documented gate values', () => {
  assert.ok(DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS.minimumPrecisionAt5 > 0);
  assert.ok(DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS.minimumRecallAt5 > 0);
  assert.ok(DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS.minimumMeanReciprocalRank > 0);
});

test('loads bundled hybrid retrieval query fixture', async () => {
  const querySet = await loadHybridRetrievalQuerySet();
  assert.equal(querySet.schemaVersion, 'hybrid-retrieval-queries.v1');
  assert.ok(querySet.queries.length >= 4);
  const categories = new Set(querySet.queries.map((q) => q.category));
  assert.ok(categories.has('name_lookup'));
  assert.ok(categories.has('misspelling'));
  assert.ok(categories.has('descriptive'));
  assert.ok(categories.has('place_query'));
});

test('fusion weight version is recorded in eval output', async () => {
  const result = await runHybridRetrievalEval(MINI_QUERY_SET, () => ['a'], {
    fusionWeights: { structured: 2, vector: 1 },
    fusionWeightsVersion: 'hybrid-fusion-weights.v2-test',
  });
  assert.equal(result.fusionWeightsVersion, 'hybrid-fusion-weights.v2-test');
  assert.deepEqual(result.fusionWeights, { structured: 2, vector: 1 });
});

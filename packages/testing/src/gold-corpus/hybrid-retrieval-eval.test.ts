/**
 * Tests for hybrid retrieval eval harness (precision/recall/MRR gates).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  compareHybridRetrievalTopK,
  DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS,
  loadHybridRetrievalQuerySet,
  runHybridRetrievalEval,
  type HybridRetrievalQuerySet,
} from './hybrid-retrieval-eval.js';
import { verifyHeldoutQualityArtifacts } from './heldout-quality-eval.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

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
      forbiddenResultIds: ['wrong-alpha'],
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

test('top-k comparison excludes empty exact baselines from overlap but retains all-query identity', async () => {
  const exact = await runHybridRetrievalEval(MINI_QUERY_SET, ({ normalizedQuery }) =>
    normalizedQuery === 'alpha' ? ['a', 'b'] : [],
  );
  const approximate = await runHybridRetrievalEval(MINI_QUERY_SET, ({ normalizedQuery }) =>
    normalizedQuery === 'alpha' ? ['a'] : [],
  );
  assert.deepEqual(compareHybridRetrievalTopK(exact, approximate), {
    meanSourceDocumentTopKOverlapAgainstExactFusion: 0.5,
    nonemptyBaselineQueryCount: 1,
    emptyBaselineQueryCount: 1,
    identicalSourceDocumentTopKRateAfterFusion: 0.5,
  });
});

test('top-k comparison reports unavailable overlap when every exact baseline is empty', async () => {
  const exact = await runHybridRetrievalEval(MINI_QUERY_SET, () => []);
  const approximate = await runHybridRetrievalEval(MINI_QUERY_SET, () => []);
  assert.deepEqual(compareHybridRetrievalTopK(exact, approximate), {
    meanSourceDocumentTopKOverlapAgainstExactFusion: null,
    nonemptyBaselineQueryCount: 0,
    emptyBaselineQueryCount: 2,
    identicalSourceDocumentTopKRateAfterFusion: 1,
  });
});

test('empty corpora, invalid cutoffs and nonfinite thresholds cannot pass an evaluation', async () => {
  await assert.rejects(
    runHybridRetrievalEval({ ...MINI_QUERY_SET, queries: [] }, () => []),
    /nonempty/,
  );
  await assert.rejects(
    runHybridRetrievalEval(MINI_QUERY_SET, () => [], { k: 0 }),
    /integer/,
  );
  await assert.rejects(
    runHybridRetrievalEval(MINI_QUERY_SET, () => [], {
      thresholds: { ...DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS, minimumRecallAt5: NaN },
    }),
    /finite/,
  );
});

test('duplicate results cannot inflate recall and missing result slots reduce precision at k', async () => {
  const result = await runHybridRetrievalEval(
    { ...MINI_QUERY_SET, queries: [MINI_QUERY_SET.queries[0]!] },
    () => ['a', 'a', 'a', 'a', 'a'],
  );
  assert.equal(result.meanRecallAt5, 0.5);
  assert.equal(result.meanPrecisionAt5, 0.2);
});

test('reports forbidden retrieval results without calling other irrelevant hits identity merges', async () => {
  const result = await runHybridRetrievalEval(MINI_QUERY_SET, ({ normalizedQuery }) =>
    normalizedQuery === 'alpha' ? ['wrong-alpha', 'x', 'a'] : ['d', 'c'],
  );
  assert.equal(result.forbiddenResultRateAt5, 0.5);
  assert.equal(result.perQuery[0]?.forbiddenResultCount, 1);
  assert.equal(result.perQuery[1]?.forbiddenResultCount, 0);
  assert.equal(result.byCategory.name_lookup?.forbiddenResultRateAt5, 1);
  assert.equal(result.byCategory.place_query?.forbiddenResultRateAt5, 0);
});

test('rejects duplicated or contradictory forbidden document labels', async () => {
  await assert.rejects(
    runHybridRetrievalEval(
      {
        ...MINI_QUERY_SET,
        queries: [{ ...MINI_QUERY_SET.queries[0]!, forbiddenResultIds: ['wrong', 'wrong'] }],
      },
      () => [],
    ),
    /Every query/,
  );
  await assert.rejects(
    runHybridRetrievalEval(
      {
        ...MINI_QUERY_SET,
        queries: [{ ...MINI_QUERY_SET.queries[0]!, forbiddenResultIds: ['a'] }],
      },
      () => [],
    ),
    /Every query/,
  );
});

test('tracked held-out corpus stays blind and aligned with provisional labels and frozen predictions', () => {
  const blindRaw = fixture('heldout-evidence-retrieval-corpus.v1.json');
  const predictionRaw = fixture('heldout-entailment-predictions.v1.json');
  const blind = JSON.parse(blindRaw) as {
    version: string;
    documents: readonly { id: string }[];
    retrievalCases: readonly { id: string }[];
    entailmentCases: readonly { id: string }[];
  };
  const gold = JSON.parse(fixture('heldout-evidence-retrieval-gold.v1.json')) as {
    benchmarkVersion: string;
    labelStatus: string;
    retrievalCases: readonly {
      id: string;
      relevantDocumentIds: readonly string[];
      forbiddenDocumentIds: readonly string[];
    }[];
    entailmentCases: readonly { id: string }[];
    limitations: readonly string[];
  };
  const predictions = JSON.parse(predictionRaw) as {
    benchmarkVersion: string;
    predictions: readonly { id: string }[];
  };

  assert.equal(blind.version, gold.benchmarkVersion);
  assert.equal(blind.version, predictions.benchmarkVersion);
  assert.equal(blind.documents.length, 6);
  assert.equal(blind.retrievalCases.length, 20);
  assert.equal(blind.entailmentCases.length, 14);
  assert.deepEqual(
    blind.retrievalCases.map(({ id }) => id),
    gold.retrievalCases.map(({ id }) => id),
  );
  assert.deepEqual(
    blind.entailmentCases.map(({ id }) => id),
    gold.entailmentCases.map(({ id }) => id),
  );
  assert.deepEqual(
    blind.entailmentCases.map(({ id }) => id),
    predictions.predictions.map(({ id }) => id),
  );
  assert.ok(
    gold.retrievalCases.every(({ relevantDocumentIds, forbiddenDocumentIds }) =>
      forbiddenDocumentIds.every((id) => !relevantDocumentIds.includes(id)),
    ),
  );
  assert.match(gold.labelStatus, /provisional/i);
  assert.ok(gold.limitations.some((limitation) => /HNSW planner/i.test(limitation)));
  assert.ok(gold.limitations.some((limitation) => /probability calibration/i.test(limitation)));
  assert.ok(
    gold.limitations.some((limitation) =>
      /false-merge behavior remains unmeasured/i.test(limitation),
    ),
  );
  assert.equal(blindRaw.includes('relevantDocumentIds'), false);
  assert.equal(blindRaw.includes('forbiddenDocumentIds'), false);
  assert.equal(blindRaw.includes('"expected"'), false);
  assert.equal(
    createHash('sha256').update(predictionRaw).digest('hex'),
    '3c64a1c3ac5587bb8917655a24b21ba510a8bf5942f3aa2dcf94ecb02c4b99bc',
  );
  assert.equal(
    createHash('sha256').update(JSON.stringify(predictions)).digest('hex'),
    'fff08c8b8c96732bbebbad56b2ccfe5e9af1ada9557a5fe8c3faa18255afc00a',
  );
});

test('identity and edge cases keep blind inputs, frozen predictions, and independent gold separate', () => {
  const blindRaw = fixture('heldout-identity-edge-corpus.v1.json');
  const predictionRaw = fixture('heldout-identity-edge-predictions.v1.json');
  const goldRaw = fixture('heldout-identity-edge-gold.v1.json');
  const freezeManifest = JSON.parse(fixture('heldout-identity-edge-freeze.v1.json')) as Record<
    string,
    unknown
  >;
  const blind = JSON.parse(blindRaw) as {
    version: string;
    identityCases: readonly { id: string }[];
    edgeCases: readonly { id: string }[];
  };
  const predictions = JSON.parse(predictionRaw) as {
    benchmarkVersion: string;
    identityPredictions: readonly { id: string }[];
    edgePredictions: readonly { id: string }[];
  };
  const gold = JSON.parse(goldRaw) as {
    benchmarkVersion: string;
    labelStatus: string;
    identityCases: readonly { id: string }[];
    edgeCases: readonly { id: string }[];
    limitations: readonly string[];
  };

  assert.equal(blind.version, predictions.benchmarkVersion);
  assert.equal(blind.version, gold.benchmarkVersion);
  assert.deepEqual(
    blind.identityCases.map(({ id }) => id),
    predictions.identityPredictions.map(({ id }) => id),
  );
  assert.deepEqual(
    blind.identityCases.map(({ id }) => id),
    gold.identityCases.map(({ id }) => id),
  );
  assert.deepEqual(
    blind.edgeCases.map(({ id }) => id),
    predictions.edgePredictions.map(({ id }) => id),
  );
  assert.deepEqual(
    blind.edgeCases.map(({ id }) => id),
    gold.edgeCases.map(({ id }) => id),
  );
  assert.equal(blindRaw.includes('"expected"'), false);
  assert.equal(predictionRaw.includes('"expected"'), false);
  assert.match(gold.labelStatus, /independent-agent-authored-provisional/);
  assert.ok(gold.limitations.some((limitation) => /not human-adjudicated/i.test(limitation)));
  assert.ok(
    gold.limitations.some((limitation) => /repeated alias pairs overlap/i.test(limitation)),
  );
  const verified = verifyHeldoutQualityArtifacts({
    casesRaw: blindRaw,
    predictionsRaw: predictionRaw,
    goldRaw,
    manifest: freezeManifest,
  });
  assert.equal(verified.integrity.bindingStatus, 'posthoc-integrity-record');
  assert.match(verified.integrity.limitation, /does not establish preregistration/i);
  assert.equal(
    createHash('sha256').update(blindRaw).digest('hex'),
    '8581645419a2eaad1c5312916f6ab02a851ef10197fa05c0369dcbc572e33d3e',
  );
  assert.equal(
    verified.integrity.originalBlindFileByteSha256,
    '7386f335cdf81a05a8379ba64f0a6763def6bad448cce0abfc297522b2a3617b',
  );
  assert.equal(
    createHash('sha256').update(predictionRaw).digest('hex'),
    'a1a3c029d44309a35ebb6b05f72ed356b323e181d95dfe7cb0dd19eb091f0bfb',
  );
  assert.equal(
    createHash('sha256').update(goldRaw).digest('hex'),
    '53dffe4d12f3c893f2b7feed7757f26ace75b891bae6cd1730bce879aed4ddae',
  );
});

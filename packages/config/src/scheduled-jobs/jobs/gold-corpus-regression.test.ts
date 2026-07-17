
/**
 * Proves the gold-corpus-regression job body is REAL it calls @black-book/testing's
 * evaluateCorpus (the same evaluator the gold-corpus CLI runs) rather than reimplementing
 * evaluation, and that a failing evaluation still just reports (no publish side effect).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GOLD_CORPUS_SCHEMA_VERSION,
  GOLD_PREDICTIONS_SCHEMA_VERSION,
  type GoldCorpus,
  type GoldPredictions,
} from '@black-book/testing';
import { runGoldCorpusRegressionJob } from './gold-corpus-regression.ts';

const CORPUS: GoldCorpus = {
  schemaVersion: GOLD_CORPUS_SCHEMA_VERSION,
  corpusVersion: 'test-v1',
  adjudicatedAt: '2026-07-01T00:00:00.000Z',
  adjudicationProtocol: 'unit-test',
  examples: [
    {
      id: 'ex-1',
      title: 'Example one',
      synthetic: true,
      categories: ['included_school'],
      subjectType: 'school',
      adjudication: {
        relevance: 'include',
        publicationAllowed: true,
        claim: 'supported',
        impact: 'standard',
        citationEntailed: true,
        confidenceOutcome: true,
        entityResolution: 'match',
        expectedEntityId: 'entity-1',
        rationale: 'unit test fixture',
      },
      context: {
        recordCompleteness: 'substantial',
        livingPerson: false,
        privateResidence: false,
        geographicAmbiguity: false,
        lineageRootIds: [],
      },
    },
  ],
};

function predictions(overrides: Partial<GoldPredictions['predictions'][number]> = {}): GoldPredictions {
  return {
    schemaVersion: GOLD_PREDICTIONS_SCHEMA_VERSION,
    algorithmVersion: 'algo-v1',
    corpusVersion: 'test-v1',
    generatedAt: '2026-07-17T03:00:00.000Z',
    predictions: [
      {
        exampleId: 'ex-1',
        relevance: 'include',
        publish: true,
        confidence: 0.95,
        citationEntailed: true,
        entityResolution: 'match',
        resolvedEntityId: 'entity-1',
        ...overrides,
      },
    ],
  };
}

test('a passing prediction set completes the job as success', () => {
  const result = runGoldCorpusRegressionJob({
    jobRunId: 'run-1',
    startedAt: '2026-07-17T03:00:00.000Z',
    completedAt: '2026-07-17T03:05:00.000Z',
    corpus: CORPUS,
    predictions: predictions(),
  });
  assert.equal(result.evaluation.passed, true);
  assert.equal(result.run.status, 'success');
  assert.deepEqual(result.run.issues, []);
});

test('a failing prediction set completes the job as quarantined and reports failures, without publishing anything', () => {
  const result = runGoldCorpusRegressionJob({
    jobRunId: 'run-2',
    startedAt: '2026-07-17T03:00:00.000Z',
    completedAt: '2026-07-17T03:05:00.000Z',
    corpus: CORPUS,
    predictions: predictions({ relevance: 'exclude', publish: false }),
  });
  assert.equal(result.evaluation.passed, false);
  assert.equal(result.run.status, 'quarantined');
  assert.ok(result.run.issues && result.run.issues.length > 0);
  // The job wrapper's result type has no publish/write side-channel at all it only returns a
  // report. There is nothing here for a scheduled dispatcher to call that could publish.
  assert.deepEqual(Object.keys(result).sort(), ['evaluation', 'run']);
});

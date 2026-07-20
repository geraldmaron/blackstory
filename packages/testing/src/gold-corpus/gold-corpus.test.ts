/**
 * Contract tests for corpus coverage, metric arithmetic, comparison reports, schemas,
 * command help, and the fail-closed automatic-publication gate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertCorpusEvaluationPassed } from './gate.ts';
import { loadGoldCorpus, loadGoldPredictions } from './load.ts';
import { calculateCorpusMetrics, evaluateCorpus } from './metrics.ts';
import { generateBeforeAfterReport } from './report.ts';
import type { GoldCategory, GoldCorpus, GoldCorpusExample, GoldPredictions } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const fixtureDirectory = join(repoRoot, 'packages', 'testing', 'src', 'gold-corpus', 'fixtures');
const corpus = loadGoldCorpus(join(fixtureDirectory, 'gold-corpus.v1.json'));
const beforePredictions = loadGoldPredictions(join(fixtureDirectory, 'predictions.before.v1.json'));
const afterPredictions = loadGoldPredictions(join(fixtureDirectory, 'predictions.after.v1.json'));
const requiredCategories: readonly GoldCategory[] = [
  'included_school',
  'excluded_school',
  'relevant_person',
  'irrelevant_person',
  'disputed_claim',
  'high_impact_claim',
  'sparse_record',
  'living_person',
  'private_residence',
  'sundown_town_candidate',
  'geographic_ambiguity',
  'source_lineage',
];

describe('versioned gold corpus', () => {
  it('contains 100–200 unique adjudicated examples and every required category', () => {
    assert.equal(corpus.schemaVersion, 'gold-corpus.v1');
    assert.match(corpus.corpusVersion, /^\d+\.\d+\.\d+$/u);
    assert.equal(corpus.examples.length, 125);
    assert.equal(new Set(corpus.examples.map(({ id }) => id)).size, corpus.examples.length);
    for (const category of requiredCategories) {
      assert.ok(
        corpus.examples.filter(({ categories }) => categories.includes(category)).length >= 10,
        `expected at least ten ${category} cases`,
      );
    }
    assert.ok(corpus.examples.every(({ synthetic }) => synthetic));
    assert.ok(corpus.examples.every(({ adjudication }) => adjudication.rationale.length >= 20));
  });

  it('ships parseable corpus, prediction, and evaluation schemas', () => {
    for (const name of [
      'gold-corpus.v1.schema.json',
      'gold-predictions.v1.schema.json',
      'gold-evaluation.v1.schema.json',
    ]) {
      const schema = JSON.parse(
        readFileSync(join(repoRoot, 'packages', 'schemas', 'gold-corpus', name), 'utf8'),
      ) as { $schema: string; additionalProperties: boolean };
      assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.equal(schema.additionalProperties, false);
    }
  });
});

function example(input: {
  readonly id: string;
  readonly expectedRelevant: boolean;
  readonly expectedPublish: boolean;
  readonly confidenceOutcome: boolean;
  readonly citationEntailed: boolean;
  readonly expectedEntityId?: string;
}): GoldCorpusExample {
  return {
    id: input.id,
    title: `Synthetic metric case ${input.id}`,
    synthetic: true,
    categories: [input.expectedRelevant ? 'included_school' : 'excluded_school'],
    subjectType: 'school',
    adjudication: {
      relevance: input.expectedRelevant ? 'include' : 'exclude',
      publicationAllowed: input.expectedPublish,
      claim: input.expectedRelevant ? 'supported' : 'unsupported',
      impact: 'standard',
      citationEntailed: input.citationEntailed,
      confidenceOutcome: input.confidenceOutcome,
      entityResolution: input.expectedEntityId === undefined ? 'no_match' : 'match',
      ...(input.expectedEntityId === undefined ? {} : { expectedEntityId: input.expectedEntityId }),
      rationale: 'Synthetic arithmetic fixture with an explicit consensus adjudication.',
    },
    context: {
      recordCompleteness: 'substantial',
      livingPerson: false,
      privateResidence: false,
      geographicAmbiguity: false,
      lineageRootIds: [`lineage-${input.id}`],
    },
  };
}

const metricCorpus: GoldCorpus = {
  schemaVersion: 'gold-corpus.v1',
  corpusVersion: 'test.1.0',
  adjudicatedAt: '2026-07-17T00:00:00.000Z',
  adjudicationProtocol: 'Test-only arithmetic labels.',
  examples: [
    example({
      id: 'case-1',
      expectedRelevant: true,
      expectedPublish: true,
      confidenceOutcome: true,
      citationEntailed: true,
      expectedEntityId: 'entity-1',
    }),
    example({
      id: 'case-2',
      expectedRelevant: true,
      expectedPublish: true,
      confidenceOutcome: true,
      citationEntailed: true,
    }),
    example({
      id: 'case-3',
      expectedRelevant: false,
      expectedPublish: false,
      confidenceOutcome: false,
      citationEntailed: false,
    }),
    example({
      id: 'case-4',
      expectedRelevant: false,
      expectedPublish: false,
      confidenceOutcome: false,
      citationEntailed: false,
    }),
  ],
};

const metricPredictions: GoldPredictions = {
  schemaVersion: 'gold-predictions.v1',
  algorithmVersion: 'metric-test.v1',
  corpusVersion: metricCorpus.corpusVersion,
  generatedAt: '2026-07-17T00:00:00.000Z',
  predictions: [
    {
      exampleId: 'case-1',
      relevance: 'include',
      publish: true,
      confidence: 0.8,
      citationEntailed: true,
      entityResolution: 'match',
      resolvedEntityId: 'entity-1',
    },
    {
      exampleId: 'case-2',
      relevance: 'exclude',
      publish: false,
      confidence: 0.6,
      citationEntailed: true,
      entityResolution: 'no_match',
    },
    {
      exampleId: 'case-3',
      relevance: 'include',
      publish: true,
      confidence: 0.7,
      citationEntailed: true,
      entityResolution: 'match',
      resolvedEntityId: 'incorrect',
    },
    {
      exampleId: 'case-4',
      relevance: 'exclude',
      publish: false,
      confidence: 0.1,
      citationEntailed: false,
      entityResolution: 'no_match',
    },
  ],
};

describe('metric harness', () => {
  it('calculates precision, recall, false publication, calibration, citation, and resolution', () => {
    const metrics = calculateCorpusMetrics(metricCorpus, metricPredictions);
    assert.deepEqual(metrics.relevance, {
      truePositive: 1,
      falsePositive: 1,
      trueNegative: 1,
      falseNegative: 1,
      precision: 0.5,
      recall: 0.5,
    });
    assert.equal(metrics.falsePublicationRate, 0.5);
    assert.ok(Math.abs(metrics.calibration.brierScore - 0.175) < Number.EPSILON);
    assert.equal(metrics.citationEntailmentAccuracy, 0.75);
    assert.equal(metrics.entityResolutionAccuracy, 0.75);
  });

  it('rejects incomplete prediction sets', () => {
    assert.throws(
      () =>
        calculateCorpusMetrics(metricCorpus, {
          ...metricPredictions,
          predictions: metricPredictions.predictions.slice(1),
        }),
      /incomplete/iu,
    );
  });
});

describe('before/after report and publication gate', () => {
  const evaluatedAt = '2026-07-17T01:00:00.000Z';
  const before = evaluateCorpus({ corpus, predictions: beforePredictions, evaluatedAt });
  const after = evaluateCorpus({ corpus, predictions: afterPredictions, evaluatedAt });

  it('reports improvements for policy or algorithm changes', () => {
    const report = generateBeforeAfterReport({ before, after, generatedAt: evaluatedAt });
    assert.equal(report.before.algorithmVersion, 'policy.v1-before');
    assert.equal(report.after.algorithmVersion, 'policy.v2-after');
    assert.ok(report.deltas.precision > 0);
    assert.ok(report.deltas.falsePublicationRate < 0);
    assert.ok(report.deltas.brierScore < 0);
    assert.deepEqual(report.regressions, []);
  });

  it('blocks automatic publication without a current passing record', () => {
    assert.throws(
      () =>
        assertCorpusEvaluationPassed({
          automaticPublicationEnabled: true,
          requiredCorpusVersion: corpus.corpusVersion,
          algorithmVersion: after.algorithmVersion,
        }),
      /requires a gold-corpus evaluation/iu,
    );
    assert.doesNotThrow(() =>
      assertCorpusEvaluationPassed({
        automaticPublicationEnabled: true,
        requiredCorpusVersion: corpus.corpusVersion,
        algorithmVersion: after.algorithmVersion,
        evaluation: after,
      }),
    );
    assert.doesNotThrow(() =>
      assertCorpusEvaluationPassed({
        automaticPublicationEnabled: false,
        requiredCorpusVersion: 'future-version',
        algorithmVersion: 'unevaluated',
      }),
    );
  });
});

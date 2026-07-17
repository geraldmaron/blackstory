/**
 * Deterministic metric calculators for complete prediction sets evaluated against a
 * versioned gold corpus.
 */
import type {
  BinaryMetrics,
  CalibrationMetrics,
  CorpusEvaluationRecord,
  CorpusMetricThresholds,
  CorpusMetrics,
  GoldCorpus,
  GoldCorpusExample,
  GoldPrediction,
  GoldPredictions,
} from './types.js';
import { GOLD_EVALUATION_SCHEMA_VERSION } from './types.js';

export const DEFAULT_CORPUS_THRESHOLDS: CorpusMetricThresholds = {
  minimumPrecision: 0.9,
  minimumRecall: 0.85,
  maximumFalsePublicationRate: 0.05,
  maximumBrierScore: 0.15,
  maximumExpectedCalibrationError: 0.1,
  minimumCitationEntailmentAccuracy: 0.9,
  minimumEntityResolutionAccuracy: 0.9,
};

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function exceeds(value: number, maximum: number): boolean {
  return value - maximum > Number.EPSILON;
}

function binaryMetrics(
  pairs: readonly { readonly expected: boolean; readonly predicted: boolean }[],
): BinaryMetrics {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const pair of pairs) {
    if (pair.expected && pair.predicted) truePositive += 1;
    else if (!pair.expected && pair.predicted) falsePositive += 1;
    else if (!pair.expected && !pair.predicted) trueNegative += 1;
    else falseNegative += 1;
  }
  return {
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    precision: divide(truePositive, truePositive + falsePositive),
    recall: divide(truePositive, truePositive + falseNegative),
  };
}

function calibrationMetrics(
  pairs: readonly { readonly confidence: number; readonly outcome: boolean }[],
): CalibrationMetrics {
  const bins = Array.from({ length: 10 }, (_, index) => {
    const members = pairs.filter(
      ({ confidence }) => Math.min(9, Math.floor(confidence * 10)) === index,
    );
    return {
      lowerBound: index / 10,
      upperBound: (index + 1) / 10,
      count: members.length,
      meanConfidence: divide(
        members.reduce((total, member) => total + member.confidence, 0),
        members.length,
      ),
      observedRate: divide(
        members.reduce((total, member) => total + (member.outcome ? 1 : 0), 0),
        members.length,
      ),
    };
  });
  const brierScore = divide(
    pairs.reduce(
      (total, pair) => total + (pair.confidence - (pair.outcome ? 1 : 0)) ** 2,
      0,
    ),
    pairs.length,
  );
  const expectedCalibrationError = divide(
    bins.reduce(
      (total, bin) =>
        total + bin.count * Math.abs(bin.meanConfidence - bin.observedRate),
      0,
    ),
    pairs.length,
  );
  return { brierScore, expectedCalibrationError, bins };
}

function predictionMap(
  corpus: GoldCorpus,
  predictionSet: GoldPredictions,
): ReadonlyMap<string, GoldPrediction> {
  if (predictionSet.corpusVersion !== corpus.corpusVersion) {
    throw new Error(
      `Prediction corpus version ${predictionSet.corpusVersion} does not match ${corpus.corpusVersion}.`,
    );
  }
  const expectedIds = new Set(corpus.examples.map(({ id }) => id));
  const predictions = new Map<string, GoldPrediction>();
  for (const prediction of predictionSet.predictions) {
    if (!expectedIds.has(prediction.exampleId)) {
      throw new Error(`Unknown gold-corpus example: ${prediction.exampleId}.`);
    }
    if (predictions.has(prediction.exampleId)) {
      throw new Error(`Duplicate prediction for gold-corpus example: ${prediction.exampleId}.`);
    }
    if (prediction.confidence < 0 || prediction.confidence > 1) {
      throw new Error(`Confidence for ${prediction.exampleId} must be between zero and one.`);
    }
    predictions.set(prediction.exampleId, prediction);
  }
  const missing = corpus.examples.filter(({ id }) => !predictions.has(id)).map(({ id }) => id);
  if (missing.length > 0) {
    throw new Error(`Predictions are incomplete; missing: ${missing.join(', ')}.`);
  }
  return predictions;
}

function entityResolutionCorrect(
  example: GoldCorpusExample,
  prediction: GoldPrediction,
): boolean {
  if (prediction.entityResolution !== example.adjudication.entityResolution) return false;
  if (example.adjudication.entityResolution !== 'match') return true;
  return prediction.resolvedEntityId === example.adjudication.expectedEntityId;
}

export function calculateCorpusMetrics(
  corpus: GoldCorpus,
  predictionSet: GoldPredictions,
): CorpusMetrics {
  const predictions = predictionMap(corpus, predictionSet);
  const aligned = corpus.examples.map((example) => ({
    example,
    prediction: predictions.get(example.id)!,
  }));
  const relevance = binaryMetrics(
    aligned.map(({ example, prediction }) => ({
      expected: example.adjudication.relevance === 'include',
      predicted: prediction.relevance === 'include',
    })),
  );
  const publication = binaryMetrics(
    aligned.map(({ example, prediction }) => ({
      expected: example.adjudication.publicationAllowed,
      predicted: prediction.publish,
    })),
  );
  return {
    exampleCount: aligned.length,
    relevance,
    publication,
    falsePublicationRate: divide(
      publication.falsePositive,
      publication.truePositive + publication.falsePositive,
    ),
    calibration: calibrationMetrics(
      aligned.map(({ example, prediction }) => ({
        confidence: prediction.confidence,
        outcome: example.adjudication.confidenceOutcome,
      })),
    ),
    citationEntailmentAccuracy: divide(
      aligned.filter(
        ({ example, prediction }) =>
          example.adjudication.citationEntailed === prediction.citationEntailed,
      ).length,
      aligned.length,
    ),
    entityResolutionAccuracy: divide(
      aligned.filter(({ example, prediction }) =>
        entityResolutionCorrect(example, prediction),
      ).length,
      aligned.length,
    ),
  };
}

export function evaluateCorpus(input: {
  readonly corpus: GoldCorpus;
  readonly predictions: GoldPredictions;
  readonly evaluatedAt: string;
  readonly thresholds?: CorpusMetricThresholds;
}): CorpusEvaluationRecord {
  const thresholds = input.thresholds ?? DEFAULT_CORPUS_THRESHOLDS;
  const metrics = calculateCorpusMetrics(input.corpus, input.predictions);
  const failures = [
    ...(metrics.relevance.precision < thresholds.minimumPrecision
      ? ['precision_below_threshold']
      : []),
    ...(metrics.relevance.recall < thresholds.minimumRecall
      ? ['recall_below_threshold']
      : []),
    ...(exceeds(metrics.falsePublicationRate, thresholds.maximumFalsePublicationRate)
      ? ['false_publication_rate_above_threshold']
      : []),
    ...(exceeds(metrics.calibration.brierScore, thresholds.maximumBrierScore)
      ? ['brier_score_above_threshold']
      : []),
    ...(exceeds(
      metrics.calibration.expectedCalibrationError,
      thresholds.maximumExpectedCalibrationError,
    )
      ? ['calibration_error_above_threshold']
      : []),
    ...(metrics.citationEntailmentAccuracy < thresholds.minimumCitationEntailmentAccuracy
      ? ['citation_entailment_accuracy_below_threshold']
      : []),
    ...(metrics.entityResolutionAccuracy < thresholds.minimumEntityResolutionAccuracy
      ? ['entity_resolution_accuracy_below_threshold']
      : []),
  ];
  return {
    schemaVersion: GOLD_EVALUATION_SCHEMA_VERSION,
    corpusVersion: input.corpus.corpusVersion,
    algorithmVersion: input.predictions.algorithmVersion,
    evaluatedAt: input.evaluatedAt,
    passed: failures.length === 0,
    thresholds,
    metrics,
    failures,
  };
}

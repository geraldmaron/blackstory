
/**
 * Builds deterministic before/after reports and identifies metric regressions between
 * policy or algorithm versions evaluated on the same corpus.
 */
import type { BeforeAfterReport, CorpusEvaluationRecord } from './types.js';

function delta(after: number, before: number): number {
  return after - before;
}

export function generateBeforeAfterReport(input: {
  readonly before: CorpusEvaluationRecord;
  readonly after: CorpusEvaluationRecord;
  readonly generatedAt: string;
}): BeforeAfterReport {
  if (input.before.corpusVersion !== input.after.corpusVersion) {
    throw new Error('Before and after evaluations must use the same corpus version.');
  }
  const deltas = {
    precision: delta(
      input.after.metrics.relevance.precision,
      input.before.metrics.relevance.precision,
    ),
    recall: delta(input.after.metrics.relevance.recall, input.before.metrics.relevance.recall),
    falsePublicationRate: delta(
      input.after.metrics.falsePublicationRate,
      input.before.metrics.falsePublicationRate,
    ),
    brierScore: delta(
      input.after.metrics.calibration.brierScore,
      input.before.metrics.calibration.brierScore,
    ),
    expectedCalibrationError: delta(
      input.after.metrics.calibration.expectedCalibrationError,
      input.before.metrics.calibration.expectedCalibrationError,
    ),
    citationEntailmentAccuracy: delta(
      input.after.metrics.citationEntailmentAccuracy,
      input.before.metrics.citationEntailmentAccuracy,
    ),
    entityResolutionAccuracy: delta(
      input.after.metrics.entityResolutionAccuracy,
      input.before.metrics.entityResolutionAccuracy,
    ),
  };
  const regressions = [
    ...(deltas.precision < 0 ? ['precision'] : []),
    ...(deltas.recall < 0 ? ['recall'] : []),
    ...(deltas.falsePublicationRate > 0 ? ['false_publication_rate'] : []),
    ...(deltas.brierScore > 0 ? ['brier_score'] : []),
    ...(deltas.expectedCalibrationError > 0 ? ['expected_calibration_error'] : []),
    ...(deltas.citationEntailmentAccuracy < 0 ? ['citation_entailment_accuracy'] : []),
    ...(deltas.entityResolutionAccuracy < 0 ? ['entity_resolution_accuracy'] : []),
  ];
  return {
    schemaVersion: 'gold-before-after-report.v1',
    corpusVersion: input.before.corpusVersion,
    generatedAt: input.generatedAt,
    before: input.before,
    after: input.after,
    deltas,
    regressions,
  };
}

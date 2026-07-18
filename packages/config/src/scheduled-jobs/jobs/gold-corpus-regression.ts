
/**
 * REAL roster entry: gold-corpus regression on engine changes. Wraps
 * @blap/testing's evaluateCorpus (packages/testing/src/gold-corpus/metrics.ts) — the same
 * evaluator the gold-corpus CLI (packages/testing/src/gold-corpus/cli.ts) already runs. This
 * wrapper does not reimplement evaluation or the automatic-publication gate
 * (assertCorpusEvaluationPassed corpusEvaluationAllowsAutomaticPublication stay in
 * @blap/testing and are called at the point something would actually gate on the result,
 * not here) it only adapts evaluateCorpus's input/output into the generic JobRunRecord shape
 * so the regression check can be scheduled through this registry. A failing evaluation never
 * publishes anything by itself; it produces a report + issues that feed run-health/alerting.
 */
import { evaluateCorpus, type CorpusEvaluationRecord, type GoldCorpus, type GoldPredictions } from '@blap/testing';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const GOLD_CORPUS_REGRESSION_JOB_ID = 'gold-corpus-regression';

export type GoldCorpusRegressionJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly corpus: GoldCorpus;
  readonly predictions: GoldPredictions;
};

export type GoldCorpusRegressionJobResult = {
  readonly run: JobRunRecord;
  readonly evaluation: CorpusEvaluationRecord;
};

export function runGoldCorpusRegressionJob(
  input: GoldCorpusRegressionJobInput,
): GoldCorpusRegressionJobResult {
  const started = startJobRun({
    jobId: GOLD_CORPUS_REGRESSION_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const evaluation = evaluateCorpus({
    corpus: input.corpus,
    predictions: input.predictions,
    evaluatedAt: input.completedAt,
  });
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.corpus.examples.length,
    itemsProcessed: evaluation.metrics.exampleCount,
    issues: evaluation.failures,
  });
  return { run, evaluation };
}

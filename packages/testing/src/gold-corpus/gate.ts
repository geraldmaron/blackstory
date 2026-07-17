
/**
 * Fail-closed gate preventing automatic publication unless the current corpus version has
 * a passing evaluation record for the algorithm being enabled.
 */
import type { CorpusEvaluationRecord } from './types.js';

export function assertCorpusEvaluationPassed(input: {
  readonly automaticPublicationEnabled: boolean;
  readonly requiredCorpusVersion: string;
  readonly algorithmVersion: string;
  readonly evaluation?: CorpusEvaluationRecord;
}): void {
  if (!input.automaticPublicationEnabled) return;
  if (input.evaluation === undefined) {
    throw new Error('Automatic publication requires a gold-corpus evaluation record.');
  }
  if (input.evaluation.corpusVersion !== input.requiredCorpusVersion) {
    throw new Error('Automatic publication evaluation uses a stale corpus version.');
  }
  if (input.evaluation.algorithmVersion !== input.algorithmVersion) {
    throw new Error('Automatic publication evaluation uses a different algorithm version.');
  }
  if (!input.evaluation.passed) {
    throw new Error(
      `Automatic publication is blocked by corpus failures: ${input.evaluation.failures.join(', ')}.`,
    );
  }
}

export function corpusEvaluationAllowsAutomaticPublication(input: {
  readonly automaticPublicationEnabled: boolean;
  readonly requiredCorpusVersion: string;
  readonly algorithmVersion: string;
  readonly evaluation?: CorpusEvaluationRecord;
}): boolean {
  try {
    assertCorpusEvaluationPassed(input);
    return true;
  } catch {
    return false;
  }
}

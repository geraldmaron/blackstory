/**
 * Include / exclude / supporting-context decision logic (BB-040).
 */
import type { ProductConstitution, RelevanceDecision } from '@black-book/schemas';
import { evaluateRelevance, loadProductConstitution } from '@black-book/schemas';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import { firstFailedGate, gateFailed } from './gates.js';
import type { RelevanceGateResult } from './types.js';

export type ProvisionalDecisionInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly compositeScore: number;
  readonly gates: readonly RelevanceGateResult[];
  readonly policy?: ProductConstitution;
};

export type ProvisionalDecisionResult = {
  readonly decision: RelevanceDecision;
  readonly exclusionReason?: string;
};

function isWeakOnlySignal(candidate: DiscoveryCandidateRecord): boolean {
  return candidate.signals.strength === 'weak' && candidate.signals.outcome === 'candidate_only';
}

/** Derive provisional decision from gates and constitution thresholds. */
export function deriveProvisionalDecision(
  input: ProvisionalDecisionInput,
): ProvisionalDecisionResult {
  const policy = input.policy ?? loadProductConstitution();
  const thresholds = policy.relevanceThresholds;
  const { candidate, compositeScore, gates } = input;

  const duplicateGate = gateFailed(gates, 'duplicate');
  if (duplicateGate) {
    return { decision: 'exclude', exclusionReason: duplicateGate.reason };
  }

  const signalGate = gateFailed(gates, 'signal_present');
  if (signalGate) {
    return { decision: 'exclude', exclusionReason: signalGate.reason };
  }

  const negativeGate = gateFailed(gates, 'negative_only');
  if (negativeGate) {
    return { decision: 'exclude', exclusionReason: negativeGate.reason };
  }

  let cappedScore = compositeScore;
  if (isWeakOnlySignal(candidate)) {
    cappedScore = Math.min(cappedScore, thresholds.weakSignalIndependentCeiling);
  }

  if (cappedScore < thresholds.excludeBelow) {
    const failed = firstFailedGate(gates);
    return {
      decision: 'exclude',
      exclusionReason:
        failed?.reason ??
        `Composite score ${cappedScore.toFixed(2)} is below exclusion threshold ${thresholds.excludeBelow}.`,
    };
  }

  const weakGate = gateFailed(gates, 'weak_signal_independent');
  const canInclude =
    cappedScore >= thresholds.includeMinimum &&
    candidate.signals.outcome === 'promotable' &&
    !weakGate;

  if (canInclude) {
    return { decision: 'include' };
  }

  if (cappedScore >= thresholds.supportingContextMinimum) {
    return { decision: 'supporting_context' };
  }

  return {
    decision: 'exclude',
    exclusionReason: `Composite score ${cappedScore.toFixed(2)} did not reach supporting-context minimum.`,
  };
}

/** Evaluate final pass/fail for the chosen decision against constitution thresholds. */
export function evaluateDecisionPasses(
  compositeScore: number,
  decision: RelevanceDecision,
  policy?: ProductConstitution,
): boolean {
  return evaluateRelevance(compositeScore, decision, policy).passes;
}

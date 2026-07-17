/**
 * Sequential relevance gates applied before threshold decisions (BB-040).
 */
import type { ProductConstitution } from '@black-book/schemas';
import { loadProductConstitution } from '@black-book/schemas';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import type { RelevanceAssessment, RelevanceEvidence, RelevanceGateResult } from './types.js';

export type RunRelevanceGatesInput = {
  readonly candidate: DiscoveryCandidateRecord;
  readonly compositeScore: number;
  readonly isDuplicate: boolean;
  readonly hasIncludeEvidence: boolean;
  readonly policy?: ProductConstitution;
};

function gate(
  gateId: RelevanceGateResult['gateId'],
  passed: boolean,
  reason: string,
): RelevanceGateResult {
  return { gateId, passed, reason };
}

function isWeakOnlySignal(candidate: DiscoveryCandidateRecord): boolean {
  return candidate.signals.strength === 'weak' && candidate.signals.outcome === 'candidate_only';
}

function isNegativeOnlySignal(candidate: DiscoveryCandidateRecord): boolean {
  const classes = candidate.signals.matchedClasses;
  return classes.length === 1 && classes[0] === 'negative';
}

function hasCorroboratingContext(candidate: DiscoveryCandidateRecord): boolean {
  const classes = new Set(candidate.signals.matchedClasses);
  const hasPositive = classes.has('positive');
  const hasPeriod = classes.has('historical') || classes.has('modern');
  const hasStrongGeography =
    candidate.geographicHints.some((hint) => hint.confidence >= 0.7) &&
    (classes.has('geographic') || classes.has('historical') || classes.has('modern'));
  return hasPositive || (hasPeriod && classes.has('geographic')) || hasStrongGeography;
}

/** Run deterministic relevance gates; failed gates constrain the final decision. */
export function runRelevanceGates(input: RunRelevanceGatesInput): readonly RelevanceGateResult[] {
  const policy = input.policy ?? loadProductConstitution();
  const thresholds = policy.relevanceThresholds;
  const { candidate, compositeScore, isDuplicate, hasIncludeEvidence } = input;

  const gates: RelevanceGateResult[] = [];

  const signalPresent = candidate.signals.matchedTerms.length > 0;
  gates.push(
    gate(
      'signal_present',
      signalPresent,
      signalPresent
        ? 'At least one query-pack term matched.'
        : 'No query-pack terms matched — candidate lacks discoverable relevance signals.',
    ),
  );

  const weakIndependentBlocked =
    !isWeakOnlySignal(candidate) ||
    (compositeScore <= thresholds.weakSignalIndependentCeiling && !hasCorroboratingContext(candidate));
  gates.push(
    gate(
      'weak_signal_independent',
      weakIndependentBlocked || !isWeakOnlySignal(candidate),
      isWeakOnlySignal(candidate)
        ? hasCorroboratingContext(candidate)
          ? 'Weak signal corroborated by additional thematic or geographic context.'
          : 'Weak signals cannot independently pass relevance without corroboration.'
        : 'Signal strength is medium or strong.',
    ),
  );

  const negativeOnly = isNegativeOnlySignal(candidate);
  gates.push(
    gate(
      'negative_only',
      !negativeOnly,
      negativeOnly
        ? 'Negative-only off-scope signal cannot support inclusion.'
        : 'Candidate is not negative-only.',
    ),
  );

  gates.push(
    gate(
      'duplicate',
      !isDuplicate,
      isDuplicate
        ? 'Candidate duplicates a prior included record.'
        : 'Candidate is distinct from prior inclusions.',
    ),
  );

  gates.push(
    gate(
      'distinctiveness',
      !isDuplicate,
      isDuplicate
        ? 'Distinctiveness check failed due to duplication.'
        : 'Candidate passes distinctiveness check.',
    ),
  );

  gates.push(
    gate(
      'include_evidence',
      hasIncludeEvidence,
      hasIncludeEvidence
        ? 'Include decision has supporting relevance evidence.'
        : 'Include decision requires documented relevance evidence.',
    ),
  );

  const thresholdPassed =
    compositeScore >= thresholds.supportingContextMinimum ||
    (compositeScore < thresholds.excludeBelow && !signalPresent);
  gates.push(
    gate(
      'threshold',
      thresholdPassed,
      thresholdPassed
        ? 'Composite score meets minimum threshold band.'
        : `Composite score ${compositeScore.toFixed(2)} is below supporting-context minimum ${thresholds.supportingContextMinimum}.`,
    ),
  );

  return gates;
}

export function gateFailed(
  gates: readonly RelevanceGateResult[],
  gateId: RelevanceGateResult['gateId'],
): RelevanceGateResult | undefined {
  return gates.find((entry) => entry.gateId === gateId && !entry.passed);
}

export function firstFailedGate(
  gates: readonly RelevanceGateResult[],
): RelevanceGateResult | undefined {
  return gates.find((entry) => !entry.passed);
}

/** Build structured evidence items from candidate signals and gate outcomes. */
export function buildRelevanceEvidence(
  candidate: DiscoveryCandidateRecord,
  gates: readonly RelevanceGateResult[],
): readonly RelevanceEvidence[] {
  const evidence: RelevanceEvidence[] = [];

  if (candidate.signals.matchedTerms.length > 0) {
    evidence.push({
      kind: 'signal',
      summary: `Matched ${candidate.signals.strength} discovery signal.`,
      detail: candidate.signals.matchedTerms.join(', '),
    });
  }

  if (candidate.signals.matchedClasses.length > 0) {
    evidence.push({
      kind: 'thematic',
      summary: 'Thematic term classes matched.',
      detail: candidate.signals.matchedClasses.join(', '),
    });
  }

  if (candidate.geographicHints.length > 0) {
    evidence.push({
      kind: 'geographic',
      summary: 'Geographic place connection detected.',
      detail: candidate.geographicHints.map((hint) => hint.text).join(', '),
    });
  }

  if (candidate.adapterRecord.classification) {
    evidence.push({
      kind: 'source',
      summary: 'Source authority considered.',
      detail: candidate.adapterRecord.classification,
    });
  }

  for (const failed of gates.filter((entry) => !entry.passed)) {
    evidence.push({
      kind: 'gate',
      summary: `Gate ${failed.gateId} failed.`,
      detail: failed.reason,
    });
  }

  return evidence;
}

export function hasIncludeEvidence(
  candidate: DiscoveryCandidateRecord,
  evidence: readonly RelevanceEvidence[],
): boolean {
  if (candidate.signals.matchedTerms.length === 0) {
    return false;
  }
  const hasSubstantiveSignal =
    candidate.signals.strength !== 'weak' ||
    candidate.signals.matchedClasses.some((value) =>
      ['positive', 'historical', 'modern'].includes(value),
    );
  const hasGeographicEvidence = evidence.some((entry) => entry.kind === 'geographic');
  return hasSubstantiveSignal || hasGeographicEvidence;
}

/**
 * BB-073 source-tier trust wiring (additive — does not change the gate wiring above).
 *
 * The constitution's `community_oral`/`self_published`/`news_reportage` classifications
 * (packages/schemas/constitution/policy.v1.json `sourceClassifications`) already carry low
 * authority weights in the composite score (../relevance/dimensions.ts
 * `SOURCE_AUTHORITY_VALUES`, paired with ../claims/confidence.ts `CLASSIFICATION_AUTHORITY` for
 * BB-043) — that weighting is pre-existing and out of this bead's file ownership. What was
 * missing was an explicit, nameable guarantee that BB-073's community adapters (RSS, Internet
 * Archive, DPLA v2) can name and test directly: a candidate whose ONLY discovery signal is weak
 * and whose source is one of these low-authority tiers must never independently reach
 * `include`, mirroring `isWeakOnlySignal`/`hasCorroboratingContext` above but keyed on source
 * tier so callers (this repo's own tests, and any future publish-time check) don't have to
 * re-derive the rule.
 */
export const LOW_AUTHORITY_SOURCE_TIERS = ['community_oral', 'self_published', 'news_reportage'] as const;

export type LowAuthoritySourceTier = (typeof LOW_AUTHORITY_SOURCE_TIERS)[number];

export function isLowAuthoritySourceTier(classification: string | undefined): boolean {
  return classification !== undefined && (LOW_AUTHORITY_SOURCE_TIERS as readonly string[]).includes(classification);
}

/**
 * Additive hard check layered on top of `evaluateCandidateRelevance`'s decision: if a weak,
 * uncorroborated, low-authority-tier candidate somehow resolved to `include`, this downgrades
 * it to `supporting_context` rather than letting it publish independently. Callers apply this
 * the same way a confidence-side caller applies
 * `enforceCrowdsourcedCannotPublishAlone` (../confidence-engine/engine.ts) — it does not alter
 * `runRelevanceGates`'s existing gate array or `evaluateCandidateRelevance`'s own logic.
 */
export function enforceLowAuthorityTierCannotIncludeIndependently(
  candidate: DiscoveryCandidateRecord,
  decision: RelevanceAssessment['decision'],
): RelevanceAssessment['decision'] {
  if (decision !== 'include') {
    return decision;
  }
  if (!isLowAuthoritySourceTier(candidate.adapterRecord.classification)) {
    return decision;
  }
  if (isWeakOnlySignal(candidate) && !hasCorroboratingContext(candidate)) {
    return 'supporting_context';
  }
  return decision;
}

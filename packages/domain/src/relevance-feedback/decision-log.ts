/**
 * Decision-log extraction: pulls accept/reject/override
 * transitions out of append-only research-case history and pairs each with the
 * relevance engine's score at decision time.
 *
 * Input shape: `readonly ResearchCaseRecord` a collection of research-case SNAPSHOTS, i.e.
 * the record objects `transitionResearchCase` (../research-case/workflow.js) already returns
 * after each transition. Because ResearchCaseRecord is immutable and workflow.ts never mutates
 * in place, retaining every snapshot a case passes through is the natural way a caller (event
 * store, audit log, or simply "keep what transitionResearchCase returned each time") already has
 * this data. Each snapshot is processed independently: its own `history.at(-1)` is the transition
 * that produced it, and its own `relevanceAssessment` is the engine verdict in effect at that
 * point. Snapshots can be mixed across many cases and need not be pre-sorted.
 *
 * Known limitation (documented, not hidden): ResearchCaseRecord retains only the CURRENT
 * relevanceAssessment, not one snapshot per historical transition. A case that cycled through
 * relevance_review more than once without an intermediate snapshot being retained by the caller
 * will only surface its latest relevance verdict pairing here, not every historical one. Callers
 * that need full per-transition fidelity must retain (or replay from an event store) one
 * ResearchCaseRecord snapshot per transition, exactly as transitionResearchCase produces them.
 */
import { hashUtf8 } from '../provenance/hashes.js';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import type { ResearchCaseRecord } from '../research-case/index.js';
import {
  RELEVANCE_FEEDBACK_SCHEMA_VERSION,
  RELEVANCE_VERDICT_TARGET_STATES,
  type HumanDisposition,
  type RelevanceCalibrationDataset,
  type RelevanceDecisionLogEntry,
} from './types.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

/**
 * Deterministic fingerprint over the relevance-assessment inputs that produced a decision 
 * same canonicalize -> JSON -> sha256 pattern confidenceInputFingerprints established
 * (packages/domain/src/confidence-engine/engine.ts), scoped to relevance-assessment inputs
 * rather than claim-confidence inputs (see types.ts module docstring for why).
 */
export function computeRelevanceInputFingerprint(
  assessment: Pick<
    RelevanceDecisionLogEntry,
    'candidateId' | 'featureValues' | 'policyVersion' | 'compositeScore'
  >,
): string {
  const payload = canonicalize({
    candidateId: assessment.candidateId,
    policyVersion: assessment.policyVersion,
    compositeScore: assessment.compositeScore,
    featureValues: assessment.featureValues.map((feature) => ({
      dimension: feature.dimension,
      value: feature.value,
      weight: feature.weight,
    })),
  });
  return `sha256:${hashUtf8(JSON.stringify(payload)).digest}`;
}

function classifyDisposition(
  targetState: ResearchCaseRecord['state'],
  assessmentDecision: RelevanceDecisionLogEntry['assessmentDecision'],
  overrideApplied: boolean,
): HumanDisposition {
  if (overrideApplied) return 'override';
  if (targetState === 'relevance_confirmed') {
    return assessmentDecision === 'exclude' ? 'reject' : 'accept';
  }
  // 'excluded' | 'insufficient_evidence'
  return assessmentDecision === 'exclude' ? 'accept' : 'reject';
}

export type ExtractRelevanceDecisionLogOptions = {
  /** Optional enrichment so entries can carry adapterId/sourceTier for source-tier precision
   * analysis. Mirrors the candidatesById lookup already used by../relevance/engine.js. */
  readonly candidatesById?: ReadonlyMap<string, DiscoveryCandidateRecord>;
};

/** Extract one decision-log entry per relevance-verdict transition found across the supplied
 * case snapshots. Snapshots with no relevanceAssessment, or whose latest transition is not a
 * relevance verdict (see RELEVANCE_VERDICT_TARGET_STATES), contribute nothing silently
 * skipped, not an error, since most snapshots in a case's lifecycle are enrichment progress. */
export function extractRelevanceDecisionLog(
  caseSnapshots: readonly ResearchCaseRecord[],
  options: ExtractRelevanceDecisionLogOptions = {},
): readonly RelevanceDecisionLogEntry[] {
  const entries: RelevanceDecisionLogEntry[] = [];

  for (const record of caseSnapshots) {
    const transition = record.history.at(-1);
    if (!transition) continue;
    if (!RELEVANCE_VERDICT_TARGET_STATES.has(transition.to)) continue;
    const assessment = record.relevanceAssessment;
    if (!assessment) continue;

    const overrideApplied = assessment.override !== undefined;
    const disposition = classifyDisposition(transition.to, assessment.decision, overrideApplied);
    const candidate = options.candidatesById?.get(record.candidateId);

    entries.push({
      schemaVersion: RELEVANCE_FEEDBACK_SCHEMA_VERSION,
      caseId: record.id,
      candidateId: record.candidateId,
      transitionIndex: record.history.length - 1,
      from: transition.from,
      to: transition.to,
      reasonCode: transition.reasonCode,
      actorId: transition.actorId,
      occurredAt: transition.occurredAt,
      assessmentDecision: assessment.decision,
      compositeScore: assessment.compositeScore,
      policyVersion: assessment.policyVersion,
      featureValues: assessment.featureValues,
      disposition,
      overrideApplied,
      ...(assessment.override ? { overrideReason: assessment.override.reason } : {}),
      inputFingerprint: computeRelevanceInputFingerprint({
        candidateId: record.candidateId,
        featureValues: assessment.featureValues,
        policyVersion: assessment.policyVersion,
        compositeScore: assessment.compositeScore,
      }),
      assessedAt: assessment.assessedAt,
      ...(candidate?.identity.sourceReferences[0]?.adapterId
        ? { adapterId: candidate.identity.sourceReferences[0].adapterId }
        : {}),
      ...(candidate?.adapterRecord.classification
        ? { sourceTier: candidate.adapterRecord.classification }
        : {}),
    });
  }

  return entries;
}

/** Build the versioned calibration-dataset export around an already-extracted decision log 
 * mirrors the shape of confidence-engine/calibration.js's exportConfidenceCalibrationDataset
 * (stable sort, explicit schemaVersion + exportedAt) without depending on it. */
export function buildRelevanceCalibrationDataset(input: {
  readonly entries: readonly RelevanceDecisionLogEntry[];
  readonly extractedAt: string;
}): RelevanceCalibrationDataset {
  return {
    schemaVersion: RELEVANCE_FEEDBACK_SCHEMA_VERSION,
    extractedAt: input.extractedAt,
    entries: [...input.entries].sort(
      (left, right) =>
        left.caseId.localeCompare(right.caseId) || left.transitionIndex - right.transitionIndex,
    ),
  };
}

/**
 * Human-approved weight changes only.
 *
 * This is the hard boundary: a `RecalibrationReport` (`recalibration-report.ts`) can motivate a
 * proposal, but nothing in this module can make a proposal take effect by itself. The flow is
 * strictly:
 *
 * report finding → `proposeWeightChange` (pure, data only)
 * → gold-corpus gate result supplied by caller (real evaluation happens in
 * `@black-book/testing`; this module never imports or reimplements it — see
 * `requireGoldCorpusGatePassed`'s structural `GoldCorpusGateInput` type, which
 * `packages/config/src/scheduled-jobs/jobs/recalibration-report.ts` fills in from a real
 * `CorpusEvaluationRecord`)
 * → `approveWeightChange` (throws unless a distinct human approver + a passing gate are both
 * present)
 * → `RelevanceWeightPolicy` (a versioned artifact mirroring the constitution versioning
 * pattern at `packages/schemas/src/constitution/`: a `policyVersion` semver + immutable,
 * content-hashed object)
 *
 * This module deliberately has no "active policy" registry, no setter, and no code path that
 * reads a `RelevanceWeightPolicy` back into `../relevance/dimensions.ts`'s
 * `RELEVANCE_DIMENSION_WEIGHTS` — wiring an approved policy into the live engine is a distinct,
 * future, human-triggered deploy step. What this module proves is the shape of the gate; see
 * `relevance-feedback.test.ts`'s "report alone cannot mutate live weights" tests.
 */
import { hashUtf8 } from '../provenance/hashes.js';
import { RELEVANCE_DIMENSIONS, RELEVANCE_DIMENSION_WEIGHTS, type RelevanceDimension } from '../relevance/index.js';
import { RELEVANCE_FEEDBACK_SCHEMA_VERSION } from './types.js';

export const RELEVANCE_WEIGHT_POLICY_SCHEMA_VERSION = 'relevance-weight-policy.v1' as const;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

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

export type RelevanceWeightPolicy = {
  readonly schemaVersion: typeof RELEVANCE_WEIGHT_POLICY_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly weights: Readonly<Record<RelevanceDimension, number>>;
  readonly contentHash: string;
  readonly createdAt: string;
};

function assertWeightsValid(weights: Readonly<Record<RelevanceDimension, number>>): void {
  for (const dimension of RELEVANCE_DIMENSIONS) {
    const value = weights[dimension];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`Relevance weight for "${dimension}" must be a finite number between 0 and 1`);
    }
  }
  const sum = RELEVANCE_DIMENSIONS.reduce((total, dimension) => total + weights[dimension], 0);
  if (Math.abs(sum - 1) > 1e-6) {
    throw new RangeError(`Relevance dimension weights must sum to 1 (got ${sum.toFixed(6)})`);
  }
}

/** The current, live-engine weight policy expressed as a RelevanceWeightPolicy artifact a
 * read-only snapshot of../relevance/dimensions.js's RELEVANCE_DIMENSION_WEIGHTS, not a copy
 * that engine reads from. Useful as `currentPolicy` when calling proposeWeightChange. */
export function currentRelevanceWeightPolicy(input: {
  readonly policyVersion: string;
  readonly createdAt: string;
}): RelevanceWeightPolicy {
  return buildRelevanceWeightPolicy({
    policyVersion: input.policyVersion,
    weights: RELEVANCE_DIMENSION_WEIGHTS,
    createdAt: input.createdAt,
  });
}

export function buildRelevanceWeightPolicy(input: {
  readonly policyVersion: string;
  readonly weights: Readonly<Record<RelevanceDimension, number>>;
  readonly createdAt: string;
}): RelevanceWeightPolicy {
  if (!SEMVER_PATTERN.test(input.policyVersion.trim())) {
    throw new Error(`Invalid semver for relevance weight policy: ${input.policyVersion}`);
  }
  assertWeightsValid(input.weights);
  const weights = Object.freeze(
    Object.fromEntries(RELEVANCE_DIMENSIONS.map((dimension) => [dimension, input.weights[dimension]])),
  ) as Readonly<Record<RelevanceDimension, number>>;
  const contentHash = `sha256:${
    hashUtf8(JSON.stringify(canonicalize({ policyVersion: input.policyVersion.trim(), weights }))).digest
  }`;
  return Object.freeze({
    schemaVersion: RELEVANCE_WEIGHT_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion.trim(),
    weights,
    contentHash,
    createdAt: input.createdAt,
  });
}

export type WeightChangeProposal = {
  readonly schemaVersion: typeof RELEVANCE_FEEDBACK_SCHEMA_VERSION;
  readonly proposalId: string;
  /** Always a system/report identity (e.g. 'system:recalibration-report') never a human. A
   * proposal is a report finding, not a human's own initiative; approveWeightChange still
   * requires a distinct human approver regardless of what this field says. */
  readonly proposedBy: string;
  readonly proposedAt: string;
  readonly rationale: string;
  readonly currentPolicy: RelevanceWeightPolicy;
  readonly candidatePolicy: RelevanceWeightPolicy;
  /** Ties the proposal back to the RecalibrationReport that motivated it. */
  readonly sourceReportGeneratedAt: string;
};

export function proposeWeightChange(input: {
  readonly proposedBy: string;
  readonly proposedAt: string;
  readonly rationale: string;
  readonly currentPolicy: RelevanceWeightPolicy;
  readonly candidatePolicy: RelevanceWeightPolicy;
  readonly sourceReportGeneratedAt: string;
}): WeightChangeProposal {
  if (!input.proposedBy.trim()) {
    throw new Error('Weight change proposal requires a non-empty proposedBy identity');
  }
  if (!input.rationale.trim()) {
    throw new Error('Weight change proposal requires a non-empty rationale');
  }
  if (input.candidatePolicy.contentHash === input.currentPolicy.contentHash) {
    throw new Error('Proposed weight policy is identical to the current policy; nothing to propose');
  }
  return Object.freeze({
    schemaVersion: RELEVANCE_FEEDBACK_SCHEMA_VERSION,
    proposalId: `weight-proposal:${input.candidatePolicy.contentHash.slice(7, 23)}`,
    proposedBy: input.proposedBy,
    proposedAt: input.proposedAt,
    rationale: input.rationale,
    currentPolicy: input.currentPolicy,
    candidatePolicy: input.candidatePolicy,
    sourceReportGeneratedAt: input.sourceReportGeneratedAt,
  });
}

/** Structural (not imported) shape of CorpusEvaluationRecord
 * (packages/testing/src/gold-corpus/types.ts). Kept structural, rather than importing
 * @black-book/testing into @black-book/domain, to avoid adding a new cross-package dependency
 * to a foundational package the real evaluation always happens in @black-book/testing
 * (evaluateCorpus assertCorpusEvaluationPassed), and a real CorpusEvaluationRecord already
 * satisfies this shape, so callers (e.g. packages/config/src/scheduled-jobs/jobs/
 * recalibration-report.ts, which already depends on both packages) pass it straight through. */
export type GoldCorpusGateInput = {
  readonly corpusVersion: string;
  readonly algorithmVersion: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
};

/** Throws unless the supplied gate result passed. Never evaluates anything itself. */
export function requireGoldCorpusGatePassed(input: {
  readonly proposal: WeightChangeProposal;
  readonly gate: GoldCorpusGateInput;
}): void {
  if (!input.gate.passed) {
    throw new Error(
      `Weight change proposal ${input.proposal.proposalId} is blocked by the gold-corpus gate: ${
        input.gate.failures.join(', ') || 'evaluation did not pass'
      }`,
    );
  }
}

export type WeightChangeApproval = {
  readonly schemaVersion: typeof RELEVANCE_FEEDBACK_SCHEMA_VERSION;
  readonly proposalId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly goldCorpusGate: GoldCorpusGateInput;
  readonly activatedPolicy: RelevanceWeightPolicy;
};

/**
 * The explicit, separate human-approval step (mirrors proposer-never-approver pattern
 * for promotion, packages/domain/src/promotion/controls.js's evaluatePromotionGate
 * proposer_approver_conflict check, and packages/operator-cli/src/promotion-boundary.test.ts's
 * proof shape). Throws if:
 * - approvedBy is empty or equal to the proposal's proposedBy (same identity proposing and
 * approving is exactly the conflict this function exists to prevent);
 * - the gold-corpus gate did not pass.
 * Only on success does it return a WeightChangeApproval carrying the now-activatable policy 
 * still just a data record. Nothing here writes it anywhere.
 */
export function approveWeightChange(input: {
  readonly proposal: WeightChangeProposal;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly goldCorpusGate: GoldCorpusGateInput;
}): WeightChangeApproval {
  if (!input.approvedBy.trim()) {
    throw new Error('Weight change approval requires a non-empty approver identity');
  }
  if (input.approvedBy === input.proposal.proposedBy) {
    throw new Error(
      'Weight change approval requires a human approver distinct from the proposer (proposer != approver)',
    );
  }
  requireGoldCorpusGatePassed({ proposal: input.proposal, gate: input.goldCorpusGate });
  return Object.freeze({
    schemaVersion: RELEVANCE_FEEDBACK_SCHEMA_VERSION,
    proposalId: input.proposal.proposalId,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    goldCorpusGate: input.goldCorpusGate,
    activatedPolicy: input.proposal.candidatePolicy,
  });
}

/**
 * Relevance and confidence feedback-loop calibration layer public surface.
 * See types.ts for the full design docstring and the invariants this module holds.
 */
export {
  RELEVANCE_FEEDBACK_SCHEMA_VERSION,
  HUMAN_DISPOSITIONS,
  RELEVANCE_VERDICT_TARGET_STATES,
  type HumanDisposition,
  type RelevanceDecisionLogEntry,
  type RelevanceCalibrationDataset,
  type DimensionDisagreementSummary,
  type SourceTierPrecisionSummary,
  type GraylistYieldSummary,
  type GraylistYieldUnavailable,
  type GraylistYieldInput,
  type RecalibrationReport,
} from './types.js';

export {
  computeRelevanceInputFingerprint,
  extractRelevanceDecisionLog,
  buildRelevanceCalibrationDataset,
  type ExtractRelevanceDecisionLogOptions,
} from './decision-log.js';

export {
  analyzeDimensionDisagreement,
  analyzeQueryPackEffectiveness,
  analyzeGraylistYield,
  analyzeSourceTierPrecision,
  buildRecalibrationReport,
} from './recalibration-report.js';

export {
  RELEVANCE_WEIGHT_POLICY_SCHEMA_VERSION,
  type RelevanceWeightPolicy,
  currentRelevanceWeightPolicy,
  buildRelevanceWeightPolicy,
  type WeightChangeProposal,
  proposeWeightChange,
  type GoldCorpusGateInput,
  requireGoldCorpusGatePassed,
  type WeightChangeApproval,
  approveWeightChange,
} from './weight-policy.js';

export {
  type RelevanceDriftWindow,
  type RelevanceDriftAlarmThresholds,
  type RelevanceDriftAlarmEvaluation,
  evaluateRelevanceDriftAlarm,
} from './drift-alarm.js';

/**
 * Verification/refresh domain surface (the related workstream): policies, cadences, per-subject
 * verification state, due-record selection, and the never-overwrite `CandidateUpdate` model.
 */
export {
  VOLATILITY_CLASSES,
  isVolatilityClass,
  REVIEW_INTERVAL_UNITS,
  reviewIntervalToMs,
  addReviewInterval,
  assertVerificationPolicyValid,
  resolveVerificationPolicy,
} from './policy.js';
export type { VolatilityClass, ReviewIntervalUnit, ReviewInterval, VerificationPolicy } from './policy.js';

export { VERIFICATION_CADENCE_SCENARIOS, DEFAULT_VERIFICATION_CADENCES } from './cadence-table.js';
export type { VerificationCadenceScenario, SeedCadenceEntry } from './cadence-table.js';

export {
  VERIFICATION_STATUSES,
  isVerificationStatus,
  VERIFICATION_SUBJECT_TYPES,
  isVerificationSubjectType,
  assertVerificationStateValid,
} from './state.js';
export type { VerificationStatus, VerificationSubjectType, VerificationState } from './state.js';

export { isRecordDue, deriveVerificationStatus, selectDueVerificationStates } from './due.js';
export type { VerificationStateProvider } from './due.js';

export {
  CANDIDATE_UPDATE_STATUSES,
  isCandidateUpdateStatus,
  assertCandidateUpdateValid,
  createCandidateUpdateFromVerificationRun,
} from './candidate-update.js';
export type { CandidateUpdateStatus, CandidateUpdate } from './candidate-update.js';

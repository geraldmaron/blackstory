/**
 * Exposes the BB-029 submission quarantine contract from one package-local boundary.
 */
export {
  SUBMISSION_QUARANTINE_POLICY_VERSION,
  DEFAULT_SUBMISSION_VALIDATION_LIMITS,
  validateAndNormalizeSubmission,
  scoreSubmissionSpam,
  fingerprintSubmission,
  createSubmissionCampaignDetector,
  createQuarantinedSubmission,
  verifyOriginalIntegrity,
} from './quarantine.js';
export type {
  SubmissionKind,
  SubmissionInboxState,
  SubmissionModerationState,
  SubmissionInput,
  NormalizedSubmission,
  SubmissionValidationReason,
  SubmissionValidationIssue,
  SubmissionValidationLimits,
  SubmissionValidationOptions,
  SubmissionValidationResult,
  SpamSignal,
  SpamAssessment,
  SubmissionPrivacy,
  SubmissionCampaignAssessment,
  SubmissionOriginal,
  QuarantinedSubmissionRecord,
  RejectedSubmission,
  SubmissionIntakeResult,
  CampaignObservation,
  CampaignDetectorOptions,
  SubmissionIntakeContext,
} from './quarantine.js';

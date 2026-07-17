/**
 * Wayback Save Page Now (SPN2) capture layer public surface (BB-073).
 */
export {
  WAYBACK_SPN_SUBMIT_URL,
  waybackSpnStatusUrl,
  SPN_STATUSES,
  type SpnCredentials,
  type SpnStatus,
  type SpnSubmitResult,
  type SpnStatusResult,
} from './types.js';

export {
  submitSpnCapture,
  parseSpnStatusResponse,
  pollSpnStatus,
  buildWaybackCaptureUrl,
  type PollSpnStatusOptions,
} from './client.js';

export {
  captureUrlToEvidencePointer,
  requireCaptureBeforeReview,
  requireCaptureForAllCandidates,
  assertReviewEligible,
  type CaptureAwareCandidate,
} from './capture-gate.js';

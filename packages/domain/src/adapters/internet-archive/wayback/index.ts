/**
 * Wayback capture layer public surface: Save Page Now (SPN2) writes, availability reads.
 */
export {
  WAYBACK_SPN_SUBMIT_URL,
  waybackSpnStatusUrl,
  SPN_STATUSES,
  WAYBACK_AVAILABILITY_URL,
  waybackAvailabilityUrl,
  WAYBACK_LOOKUP_MISS_REASONS,
  type SpnCredentials,
  type SpnStatus,
  type SpnSubmitResult,
  type SpnStatusResult,
  type WaybackSnapshot,
  type WaybackLookupMissReason,
  type WaybackLookupResult,
} from './types.js';

export {
  lookupWaybackSnapshot,
  parseWaybackAvailabilityResponse,
  type LookupWaybackSnapshotOptions,
} from './availability.js';

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

/**
 * Corrections and contribution intake API entrypoint (Cloud Run target).
 * Quarantine-write-only posture enforced via surface capabilities.
 */
import { buildSurfaceHealth, parseNodeEnv } from '@repo/config';
import { SURFACE_ID } from './posture.js';

export { createSubmissionsApiClientAttestationGuard } from './client-attestation.js';
export type { SubmissionsApiClientAttestationOptions } from './client-attestation.js';
/** @deprecated Use `createSubmissionsApiClientAttestationGuard` — Firebase App Check retired after ADR-020. */
export { createSubmissionsApiAppCheckGuard } from './app-check.js';
export type { SubmissionsApiAppCheckOptions } from './app-check.js';
export { createSubmissionsRateLimitGuard, resolveSubmissionsEndpointClass } from './rate-limits.js';
export type {
  SubmissionsRateLimitGuardDecision,
  SubmissionsRateLimitGuardOptions,
  SubmissionsRateLimitRequest,
} from './rate-limits.js';
export {
  createInMemorySubmissionQuarantineRepository,
  createSubmissionQuarantineService,
} from './quarantine.js';
export type {
  SubmissionSecurityContext,
  ModerationActor,
  SubmissionAuditEvent,
  BlockedSubject,
  SubmissionQuarantineRepository,
  QuarantineIntakeRequest,
  QuarantineIntakeResponse,
  SubmissionQuarantineServiceOptions,
} from './quarantine.js';
export { guardIncomingAuth, guardIntakeOperation, guardPublishAttempt } from './posture.js';

// --- Corrections intake HTTP route (MOB-016 / repo-zir9) ---
export {
  CORRECTION_CATEGORIES,
  CORRECTION_TARGET_TYPES,
  isCorrectionCategory,
  isCorrectionTargetType,
} from './corrections/categories.js';
export type { CorrectionCategory, CorrectionTargetType } from './corrections/categories.js';
export { createReceiptCode, digestReceiptCode, receiptCodesMatch } from './corrections/receipt-code.js';
export { validateCorrectionSubmission } from './corrections/correction-intake.js';
export type {
  CorrectionFieldIssue,
  CorrectionSubmissionInput,
} from './corrections/correction-intake.js';
export { buildPublicCorrectionStatus, mapModerationToPublicPhase } from './corrections/public-status.js';
export type { PublicCorrectionPhase, PublicCorrectionStatus } from './corrections/public-status.js';
export { createCorrectionReceiptStore } from './corrections/store.js';
export type { CorrectionReceiptStore, StoredCorrectionReceipt } from './corrections/store.js';
export { createIdempotencyCache } from './corrections/idempotency-cache.js';
export type { IdempotencyCache } from './corrections/idempotency-cache.js';
export { dispatch as dispatchCorrectionsV1 } from './http/router.js';
export type { ApiRequest, ApiResponse, HandlerDeps } from './http/handlers.js';
export { createSubmissionsApiServer } from './http/server.js';
export type { SubmissionsApiServerLimits, SubmissionsApiServerOptions } from './http/server.js';

export function health() {
  return buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(health()));
}

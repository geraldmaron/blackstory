/**
 * Corrections and contribution intake API entrypoint (Cloud Run target).
 * Quarantine-write-only posture enforced via surface capabilities.
 */
import { buildSurfaceHealth, parseNodeEnv } from '@black-book/config';
import { SURFACE_ID } from './posture.js';

export { createSubmissionsApiAppCheckGuard } from './app-check.js';
export type { SubmissionsApiAppCheckOptions } from './app-check.js';
export {
  createSubmissionsRateLimitGuard,
  resolveSubmissionsEndpointClass,
} from './rate-limits.js';
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

export function health() {
  return buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV));
}

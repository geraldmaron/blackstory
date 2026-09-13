/**
 * Quarantine-write-only posture helpers for the submissions API (see docs/decisions-carryover.md,
 * "Service surface separation" — ADR-005 does not exist). This surface's guards are called for
 * real from quarantine.ts, unlike the equivalent helpers in apps/api-public.
 */
import {
  assertOperationAllowed,
  rejectPublicationOperation,
  type AuthMode,
  type OperationId,
} from '@repo/config';

export const SURFACE_ID = 'api-submissions' as const;

export function guardIntakeOperation(operation: OperationId): void {
  assertOperationAllowed(SURFACE_ID, operation);
}

export function guardIncomingAuth(authMode: AuthMode): void {
  if (authMode === 'service-identity' || authMode === 'iap-session') {
    throw new Error('api-submissions accepts only anonymous or end-user intake tokens');
  }
}

export function guardPublishAttempt(operation: OperationId): void {
  rejectPublicationOperation(SURFACE_ID, operation);
}

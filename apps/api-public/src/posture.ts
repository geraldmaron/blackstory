/**
 * Read-only posture helpers for the public API surface (see docs/decisions-carryover.md, "Service
 * surface separation" — ADR-005 does not exist). NOTE: these guards are not called from the live
 * dispatch path in ./http/router.ts, which enforces read-only via a hardcoded GET/HEAD check
 * instead; this file's guards are exercised only by tests today.
 */
import {
  assertOperationAllowed,
  rejectCanonicalWriteOperation,
  rejectPublicationOperation,
  type AuthMode,
  type OperationId,
} from '@repo/config';

export const SURFACE_ID = 'api-public' as const;

export function guardReadOperation(operation: OperationId): void {
  assertOperationAllowed(SURFACE_ID, operation);
}

export function guardIncomingAuth(authMode: AuthMode): void {
  if (authMode === 'service-identity') {
    throw new Error('api-public must not accept service-identity on the public internet');
  }
}

export function guardMutationAttempt(operation: OperationId): void {
  rejectCanonicalWriteOperation(SURFACE_ID, operation);
  rejectPublicationOperation(SURFACE_ID, operation);
}

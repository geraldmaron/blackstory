/**
 * Read-only posture helpers for the public API surface (ADR-005 / BB-021).
 */
import {
  assertOperationAllowed,
  rejectCanonicalWriteOperation,
  rejectPublicationOperation,
  type AuthMode,
  type OperationId,
} from '@black-book/config';

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

/** Quarantine-only intake capabilities; publication requires the internal service boundary. */
import {
  assertAuthAccepted,
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
  assertAuthAccepted(SURFACE_ID, authMode);
}

export function guardPublishAttempt(operation: OperationId): void {
  rejectPublicationOperation(SURFACE_ID, operation);
}

/**
 * Private-network, service-identity-only posture for internal publication APIs.
 */
import {
  assertAuthAccepted,
  assertOperationAllowed,
  type AuthMode,
  type OperationId,
} from '@blap/config';

export const SURFACE_ID = 'api-internal' as const;

export function guardPublicationOperation(operation: OperationId): void {
  assertOperationAllowed(SURFACE_ID, operation);
}

export function guardIncomingAuth(authMode: AuthMode): void {
  assertAuthAccepted(SURFACE_ID, authMode);
}

export function rejectEndUserToken(authMode: AuthMode): void {
  if (authMode === 'end-user-token' || authMode === 'anonymous') {
    throw new Error('api-internal cannot be invoked with end-user or anonymous tokens');
  }
}

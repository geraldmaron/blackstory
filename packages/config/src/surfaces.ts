/**
 * Typed capabilities for application surfaces. This is a code contract; deployment manifests
 * and live network isolation require separate verification.
 */

export const SURFACE_IDS = [
  'web',
  'api-public',
  'api-submissions',
  'api-internal',
  'admin',
] as const;

export type SurfaceId = (typeof SURFACE_IDS)[number];

export type NetworkPosture =
  | 'public-cdn'
  | 'public-read'
  | 'public-rate-limited'
  | 'service-authenticated'
  | 'staff-authenticated';

export type AuthMode = 'anonymous' | 'end-user-token' | 'service-identity' | 'staff-session';

export type OperationId =
  | 'read:public-projections'
  | 'read:search'
  | 'read:location'
  | 'write:quarantine'
  | 'write:submission-metadata'
  | 'write:canonical'
  | 'publish:projection'
  | 'promote:release'
  | 'admin:research-console'
  | 'admin:publication-review';

export interface SurfaceDefinition {
  readonly id: SurfaceId;
  readonly appPath: string;
  readonly runtime: 'vercel' | 'node-service';
  /** Logical credential scope; this does not assert an independently deployed identity. */
  readonly credentialScope: string;
  readonly networkPosture: NetworkPosture;
  readonly allowedOperations: readonly OperationId[];
  readonly acceptedAuth: readonly AuthMode[];
  readonly mustNotAcceptAuth: readonly AuthMode[];
}

const ALL_PUBLISH_OPS = [
  'publish:projection',
  'promote:release',
] as const satisfies readonly OperationId[];
const ALL_CANONICAL_WRITES = ['write:canonical'] as const satisfies readonly OperationId[];

export const SURFACE_DEFINITIONS: Readonly<Record<SurfaceId, SurfaceDefinition>> = {
  web: {
    id: 'web',
    appPath: 'apps/web',
    runtime: 'vercel',
    credentialScope: 'web-runtime',
    networkPosture: 'public-cdn',
    allowedOperations: ['read:public-projections', 'read:search', 'read:location'],
    acceptedAuth: ['anonymous', 'end-user-token'],
    mustNotAcceptAuth: ['service-identity'],
  },
  'api-public': {
    id: 'api-public',
    appPath: 'apps/api-public',
    runtime: 'vercel',
    credentialScope: 'api-public',
    networkPosture: 'public-read',
    allowedOperations: ['read:public-projections', 'read:search', 'read:location'],
    acceptedAuth: ['anonymous', 'end-user-token'],
    mustNotAcceptAuth: ['service-identity'],
  },
  'api-submissions': {
    id: 'api-submissions',
    appPath: 'apps/api-submissions',
    runtime: 'node-service',
    credentialScope: 'api-submissions',
    networkPosture: 'public-rate-limited',
    allowedOperations: ['write:quarantine', 'write:submission-metadata'],
    acceptedAuth: ['anonymous', 'end-user-token'],
    mustNotAcceptAuth: ['service-identity', 'staff-session'],
  },
  'api-internal': {
    id: 'api-internal',
    appPath: 'apps/api-internal',
    runtime: 'node-service',
    credentialScope: 'api-internal',
    networkPosture: 'service-authenticated',
    allowedOperations: [
      'write:canonical',
      'publish:projection',
      'promote:release',
      'read:public-projections',
    ],
    acceptedAuth: ['service-identity'],
    mustNotAcceptAuth: ['anonymous', 'end-user-token', 'staff-session'],
  },
  admin: {
    id: 'admin',
    // Staff authorization is enforced within the shared Vercel web deployment.
    appPath: 'apps/web/src/admin',
    runtime: 'vercel',
    credentialScope: 'admin',
    networkPosture: 'staff-authenticated',
    allowedOperations: [
      'read:public-projections',
      'admin:research-console',
      'admin:publication-review',
    ],
    acceptedAuth: ['staff-session'],
    mustNotAcceptAuth: ['anonymous', 'end-user-token', 'service-identity'],
  },
};

export class SurfaceCapabilityError extends Error {
  readonly surfaceId: SurfaceId;
  readonly reason: 'operation-denied' | 'auth-denied';

  constructor(surfaceId: SurfaceId, reason: 'operation-denied' | 'auth-denied', message: string) {
    super(message);
    this.name = 'SurfaceCapabilityError';
    this.surfaceId = surfaceId;
    this.reason = reason;
  }
}

export function getSurfaceDefinition(surfaceId: SurfaceId): SurfaceDefinition {
  return SURFACE_DEFINITIONS[surfaceId];
}

export function isOperationAllowed(surfaceId: SurfaceId, operation: OperationId): boolean {
  return getSurfaceDefinition(surfaceId).allowedOperations.includes(operation);
}

export function assertOperationAllowed(surfaceId: SurfaceId, operation: OperationId): void {
  if (!isOperationAllowed(surfaceId, operation)) {
    throw new SurfaceCapabilityError(
      surfaceId,
      'operation-denied',
      `Surface ${surfaceId} cannot perform ${operation}`,
    );
  }
}

export function isAuthAccepted(surfaceId: SurfaceId, authMode: AuthMode): boolean {
  const definition = getSurfaceDefinition(surfaceId);
  return (
    definition.acceptedAuth.includes(authMode) && !definition.mustNotAcceptAuth.includes(authMode)
  );
}

export function assertAuthAccepted(surfaceId: SurfaceId, authMode: AuthMode): void {
  const definition = getSurfaceDefinition(surfaceId);
  if (definition.mustNotAcceptAuth.includes(authMode)) {
    throw new SurfaceCapabilityError(
      surfaceId,
      'auth-denied',
      `Surface ${surfaceId} must not accept ${authMode}`,
    );
  }
  if (!definition.acceptedAuth.includes(authMode)) {
    throw new SurfaceCapabilityError(
      surfaceId,
      'auth-denied',
      `Surface ${surfaceId} does not accept ${authMode}`,
    );
  }
}

/** True when the surface cannot publish projections or activate releases. */
export function deniesPublication(surfaceId: SurfaceId): boolean {
  return ALL_PUBLISH_OPS.every((operation) => !isOperationAllowed(surfaceId, operation));
}

/** True when the surface cannot write canonical records. */
export function deniesCanonicalWrite(surfaceId: SurfaceId): boolean {
  return ALL_CANONICAL_WRITES.every((operation) => !isOperationAllowed(surfaceId, operation));
}

export function rejectPublicationOperation(surfaceId: SurfaceId, operation: OperationId): void {
  if (ALL_PUBLISH_OPS.includes(operation as (typeof ALL_PUBLISH_OPS)[number])) {
    assertOperationAllowed(surfaceId, operation);
  }
}

export function rejectCanonicalWriteOperation(surfaceId: SurfaceId, operation: OperationId): void {
  if (ALL_CANONICAL_WRITES.includes(operation as (typeof ALL_CANONICAL_WRITES)[number])) {
    assertOperationAllowed(surfaceId, operation);
  }
}

export interface SurfaceHealthPayload {
  readonly service: string;
  readonly surface: SurfaceId;
  readonly networkPosture: NetworkPosture;
  readonly allowedOperations: readonly OperationId[];
  readonly status: 'ok';
  readonly env: 'development' | 'test' | 'staging' | 'production';
}

export function buildSurfaceHealth(
  surfaceId: SurfaceId,
  env: 'development' | 'test' | 'staging' | 'production',
): SurfaceHealthPayload {
  const definition = getSurfaceDefinition(surfaceId);
  return {
    service: definition.id,
    surface: surfaceId,
    networkPosture: definition.networkPosture,
    allowedOperations: definition.allowedOperations,
    status: 'ok',
    env,
  };
}

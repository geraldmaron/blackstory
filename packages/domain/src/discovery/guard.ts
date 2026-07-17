/**
 * Discovery publication guard discovery NEVER creates public entities.
 */
export const FORBIDDEN_DISCOVERY_OPERATIONS = [
  'write_public_projection',
  'create_public_entity',
  'activate_release',
  'publish_snapshot',
] as const;

export type ForbiddenDiscoveryOperation = (typeof FORBIDDEN_DISCOVERY_OPERATIONS)[number];

export type DiscoveryOperationAttempt = {
  readonly operation: string;
  readonly target?: string;
};

function isForbiddenOperation(operation: string): operation is ForbiddenDiscoveryOperation {
  return (FORBIDDEN_DISCOVERY_OPERATIONS as readonly string[]).includes(operation);
}

/**
 * Throws when a discovery workflow attempts a public publication side effect.
 * Call at pipeline boundaries before any write that could reach public surfaces.
 */
export function assertDiscoveryCannotPublish(attempt: DiscoveryOperationAttempt): void {
  if (isForbiddenOperation(attempt.operation)) {
    throw new Error(
      `Discovery cannot publish: operation "${attempt.operation}" is forbidden` +
        (attempt.target ? ` (target=${attempt.target})` : ''),
    );
  }
}

/** Validates that a batch of planned operations contains no publication writes. */
export function validateDiscoveryOperationsSafe(
  operations: readonly DiscoveryOperationAttempt[],
): void {
  for (const attempt of operations) {
    assertDiscoveryCannotPublish(attempt);
  }
}

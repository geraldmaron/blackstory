
/**
 * The non-negotiable invariant for this whole: automation cannot publish. This module does
 * not reimplement that guard it calls straight through to assertDiscoveryCannotPublish
 * (packages/domain/src/discovery/guard.ts), the same function the discovery pipeline itself
 * calls at its own write boundaries. Every scheduled-job code path that could reach a public
 * surface must call assertScheduledJobOperationAllowed before attempting the write.
 *
 * A job's declared `publicEffect` (see types.ts) is routing/kill-switch metadata only. It is
 * never consulted here to skip the check even the two pre-approved exceptions
 * (link-repair-archived-copy, release-coupled-rebuild) still go through the real guard, because
 * those exceptions cover specific mechanical writes (an archived-copy URL swap; a regenerated
 * derived artifact) that are not among FORBIDDEN_DISCOVERY_OPERATIONS in the first place they
 * are not a bypass of it.
 */
import { assertDiscoveryCannotPublish, type DiscoveryOperationAttempt } from '@repo/domain';
import type { ScheduledJobDefinition } from './types.js';

export function assertScheduledJobOperationAllowed(input: {
  readonly job: ScheduledJobDefinition;
  readonly attempt: DiscoveryOperationAttempt;
}): void {
  assertDiscoveryCannotPublish(input.attempt);
}

export function jobDeclaresPublicEffect(job: ScheduledJobDefinition): boolean {
  return job.publicEffect !== 'none';
}

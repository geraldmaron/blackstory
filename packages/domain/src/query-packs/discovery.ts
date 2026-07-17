/**
 * Discovery-run stamping with query-pack version for reproducibility (BB-038).
 */
import type { DiscoveryRunContext, QueryPack, StampedDiscoveryRun } from './types.js';

export function stampDiscoveryRun(
  context: DiscoveryRunContext,
  pack: QueryPack,
  stampedAt: string,
): StampedDiscoveryRun {
  if (!context.runId.trim()) {
    throw new Error('Discovery runId is required');
  }
  if (!context.adapterId.trim()) {
    throw new Error('Discovery adapterId is required');
  }
  if (!context.startedAt.trim()) {
    throw new Error('Discovery startedAt is required');
  }
  if (!stampedAt.trim()) {
    throw new Error('stampedAt is required');
  }

  return {
    ...context,
    queryPackId: pack.id,
    queryPackVersionId: pack.versionId,
    queryPackSemver: pack.version.semver,
    queryPackContentHash: pack.version.contentHash,
    stampedAt,
  };
}

export function assertDiscoveryRunStamped(run: StampedDiscoveryRun): void {
  if (!run.queryPackVersionId.includes('+')) {
    throw new Error('Stamped discovery run must include composite queryPackVersionId');
  }
  if (!run.queryPackContentHash || run.queryPackContentHash.length !== 64) {
    throw new Error('Stamped discovery run must include sha256 queryPackContentHash');
  }
}

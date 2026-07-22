/**
 * Async release-activation orchestration for Postgres SoR (MOB-005).
 *
 * Reuses domain validation and manifest generation from `@repo/domain` while persisting through
 * the Postgres `PostgresReleaseStore`. Firestore remains an explicit opt-in rollback path via
 * `@repo/firebase` — this module is the primary activation surface after ADR-020 cutover.
 */
import {
  ReleaseActivationError,
  publicReleaseBootstrapPath,
  validateGeneratedArtifacts,
  type ActivationResult,
  type GeneratedRelease,
  type GcOptions,
  type GcResult,
  type RollbackOptions,
} from '@repo/domain';
import type { PostgresReleaseStore } from './release-store.js';

export type AsyncActivateOptions = {
  readonly expectedPointerVersion?: number;
};

export async function activateReleaseAsync(
  store: PostgresReleaseStore,
  generated: GeneratedRelease,
  options: AsyncActivateOptions = {},
): Promise<ActivationResult> {
  const base = await store.getPointer();
  const expectedVersion = options.expectedPointerVersion ?? base?.pointerVersion ?? 0;

  validateGeneratedArtifacts(generated);

  for (const artifact of generated.artifacts) {
    await store.putArtifact(artifact);
  }

  await store.putRelease({
    releaseId: generated.releaseId,
    manifest: generated.manifest,
    artifactPaths: generated.artifacts.map((artifact) => artifact.path),
  });

  const next = {
    activeReleaseId: generated.releaseId,
    ...(base?.activeReleaseId !== undefined ? { previousReleaseId: base.activeReleaseId } : {}),
    releaseStamp: generated.manifest.releaseStamp,
    bootstrapPath: publicReleaseBootstrapPath(generated.releaseId),
    activatedAt: generated.generatedAt,
    pointerVersion: expectedVersion + 1,
  };
  await store.flipPointer(next, expectedVersion);

  return { pointer: next, releaseStamp: next.releaseStamp };
}

export async function rollbackToAsync(
  store: PostgresReleaseStore,
  targetReleaseId: string,
  options: RollbackOptions = {},
): Promise<ActivationResult> {
  const target = await store.getRelease(targetReleaseId);
  if (!target) {
    throw new ReleaseActivationError(
      'MISSING_RELEASE',
      `Cannot roll back to ${targetReleaseId}: release not found (garbage-collected or never activated)`,
    );
  }

  for (const [, ref] of Object.entries(target.manifest.artifactHashes)) {
    const stored = await store.getArtifact(ref.path);
    if (!stored) {
      throw new ReleaseActivationError(
        'MISSING_ARTIFACT',
        `Release ${target.releaseId} artifact "${ref.path}" is missing from the store`,
      );
    }
    if (stored.hash.digest !== ref.hash.digest) {
      throw new ReleaseActivationError(
        'RELEASE_VALIDATION',
        `Release ${target.releaseId} artifact hash drifted from its manifest`,
      );
    }
  }

  if (options.platformSchemaVersion !== undefined) {
    const { min, max } = target.manifest.schemaRange;
    if (options.platformSchemaVersion < min || options.platformSchemaVersion > max) {
      throw new ReleaseActivationError(
        'ROLLBACK_SCHEMA_INCOMPATIBLE',
        `Refusing to roll back to ${targetReleaseId}: its schema range [${min}, ${max}] does not ` +
          `cover platform schema ${options.platformSchemaVersion}`,
      );
    }
  }

  const base = await store.getPointer();
  const expectedVersion = options.expectedPointerVersion ?? base?.pointerVersion ?? 0;
  const next = {
    activeReleaseId: target.releaseId,
    ...(base?.activeReleaseId !== undefined ? { previousReleaseId: base.activeReleaseId } : {}),
    releaseStamp: target.manifest.releaseStamp,
    bootstrapPath: publicReleaseBootstrapPath(target.releaseId),
    activatedAt: target.manifest.activeRelease.generatedAt,
    pointerVersion: expectedVersion + 1,
  };
  await store.flipPointer(next, expectedVersion);
  return { pointer: next, releaseStamp: next.releaseStamp };
}

/**
 * Garbage collection policy (repo-hi8c concern 2 — owner-confirmed):
 * retain active + immediately-previous release only; `GcOptions.retain` pins extras.
 * One-deep rollback depth is intentional for launch — deeper history requires GCS/CDN pins.
 */
export async function collectGarbageAsync(
  store: PostgresReleaseStore,
  options: GcOptions = {},
): Promise<GcResult> {
  const pointer = await store.getPointer();
  const keep = new Set<string>(options.retain ?? []);
  if (pointer) {
    keep.add(pointer.activeReleaseId);
    if (pointer.previousReleaseId) {
      keep.add(pointer.previousReleaseId);
    }
  }
  const deleted: string[] = [];
  for (const releaseId of await store.listReleaseIds()) {
    if (keep.has(releaseId)) continue;
    await store.deleteRelease(releaseId);
    deleted.push(releaseId);
  }
  return { deleted, retained: [...keep] };
}

/**
 * Loads release-scoped catalog artifacts from the configured public-media origin. Require the
 * live active-release id, reject mismatches and malformed artifacts, disable fixture fallback,
 * and fall back to Postgres on a miss. In-place corrections can replace an artifact under the
 * same release id.
 */
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
  type ArtifactFetchImpl,
} from '@repo/ops-data';
import type { PublicEntityProjectionDoc, PublicSearchProjectionDoc } from '@repo/schemas';
import { parseEntityProjection, parseSearchProjection } from './postgres-projection.js';

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export type ReleaseArtifactLoadOptions = {
  readonly env?: EnvironmentLike;
  /** Injected transport keeps unit tests off the network. */
  readonly fetchImpl?: ArtifactFetchImpl;
};

/** True when an explicit artifact origin is configured (never inferred). */
export function hasReleaseArtifactOrigin(env: EnvironmentLike = process.env): boolean {
  const origin = env.APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL?.trim();
  return Boolean(origin && origin.length > 0);
}

/** Fixture artifacts must never reach the serving path; remote origin only. */
function fetchOptions(options: ReleaseArtifactLoadOptions) {
  return {
    allowLocalFallback: false as const,
    ...(options.env ? { env: options.env as NodeJS.ProcessEnv } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  };
}

export async function loadEntityProjectionsFromArtifact(
  releaseId: string,
  options: ReleaseArtifactLoadOptions = {},
): Promise<readonly PublicEntityProjectionDoc[] | undefined> {
  if (!hasReleaseArtifactOrigin(options.env ?? process.env)) return undefined;
  const artifact = await fetchReleaseEntitiesListArtifact(releaseId, fetchOptions(options));
  if (!artifact || artifact.entities.length === 0) return undefined;
  const projections: PublicEntityProjectionDoc[] = [];
  for (const entity of artifact.entities) {
    const parsed = parseEntityProjection(entity);
    if (parsed) projections.push(parsed);
  }
  return projections.length > 0 ? projections : undefined;
}

export async function loadSearchIndexDocsFromArtifact(
  releaseId: string,
  options: ReleaseArtifactLoadOptions = {},
): Promise<readonly PublicSearchProjectionDoc[] | undefined> {
  if (!hasReleaseArtifactOrigin(options.env ?? process.env)) return undefined;
  const artifact = await fetchReleaseSearchIndexArtifact(releaseId, fetchOptions(options));
  if (!artifact || artifact.docs.length === 0) return undefined;
  const docs: PublicSearchProjectionDoc[] = [];
  for (const doc of artifact.docs) {
    const parsed = parseSearchProjection(doc);
    if (parsed) docs.push(parsed);
  }
  return docs.length > 0 ? docs : undefined;
}

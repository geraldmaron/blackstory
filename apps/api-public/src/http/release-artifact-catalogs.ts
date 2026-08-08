/**
 * ADR-004 release-catalog artifacts as a read-through cache for `apps/api-public` (repo-csw0).
 *
 * Cloud Run instances scale to zero, so every cold start previously pulled the full multi-MB
 * entity catalog and search index out of Postgres. Those objects are release-versioned and
 * immutable, so they are served from the public-media CDN instead when an artifact origin is
 * configured.
 *
 * Postgres stays the system of record and the safety properties are explicit:
 * - artifacts are used only when `APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL` names an origin, so an
 *   unconfigured deployment can never pick one up implicitly;
 * - `allowLocalFallback: false` keeps `packages/ops-data/fixtures/release-artifacts` out of the
 *   serving path — a fixture slice must never shadow `bb_public`;
 * - the caller passes the release id from the live `active_release` pointer and the shared
 *   fetchers reject any artifact whose `releaseId` differs, so a stale object is ignored;
 * - every loader returns `undefined` on any miss/parse failure, and the caller falls back to
 *   Postgres.
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

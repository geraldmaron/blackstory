/**
 * Mobile wire-contract types (MOB-009 / repo-hfz0).
 *
 * Public DTO types are re-exported from `@repo/public-contracts` so the native
 * client cannot drift from the shared zod schemas consumed by apps/api-public.
 * Manifest / release-stamp views that live only in the publication pipeline
 * (not on the public wire) stay local here.
 */
export type { RevisionMetadataV1 } from '@repo/public-contracts/v1/revision';
export type { BootstrapResponseV1 } from '@repo/public-contracts/v1/bootstrap';
export type { EntityV1 } from '@repo/public-contracts/v1/entity';

/**
 * A content-addressed artifact reference as declared in the fuller
 * MobileBootstrapManifest.artifactHashes (publication pipeline). The
 * `/v1/bootstrap` projection does not carry these; artifact verification
 * checks freshly-fetched bytes against the declared hash.
 */
export interface ManifestArtifactHashRef {
  readonly path: string;
  /** Lowercase hex sha-256 digest of the canonical artifact bytes. */
  readonly hash: string;
  readonly byteLength: number;
}

/**
 * Subset of the release manifest the client needs to invalidate and verify
 * its cache. The client treats `releaseStamp` as an opaque equality key.
 */
export interface ReleaseManifestView {
  readonly releaseStamp: string;
  readonly activeRelease: import('@repo/public-contracts/v1/revision').RevisionMetadataV1;
  readonly artifactHashes: Readonly<Record<string, ManifestArtifactHashRef>>;
  readonly degradedMode: boolean;
}

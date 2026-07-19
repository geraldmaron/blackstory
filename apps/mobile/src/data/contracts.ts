/**
 * Vendored wire-contract type shapes (MOB-009).
 *
 * INTEGRATION GAP — READ THIS.
 * `apps/mobile` ships its OWN isolated npm lockfile (it is NOT part of the pnpm
 * workspace symlink graph). At the time this module was written there is no
 * `@repo` scope inside `apps/mobile/node_modules`, so `@repo/public-contracts`
 * and `@repo/domain` cannot be imported here today. Rather than silently invent
 * incompatible shapes, we vendor the MINIMAL structural subset the data layer
 * needs, each field kept identical to its source of truth. When the workspace
 * wiring is fixed (follow-up bead), delete this file and import the real zod
 * types instead.
 *
 * SOURCE OF TRUTH (do not drift from these):
 *   - BootstrapResponseV1   → packages/public-contracts/src/v1/bootstrap.ts
 *   - RevisionMetadataV1     → packages/public-contracts/src/v1/revision.ts
 *   - MobileBootstrapManifest / release-stamp derivation
 *                            → packages/domain/src/publication/mobile-bootstrap.ts
 *   - EntityV1 / SearchResponseV1 / MapViewport
 *                            → packages/public-contracts/src/v1/{entity,search,map}.ts
 *
 * We deliberately vendor TYPES only (no zod runtime). Runtime validation the
 * data layer performs is structural + hash-based (see hashing.ts / release-cache.ts):
 * a full schema re-validation belongs in the contracts package and would pull
 * zod into the mobile bundle, which is out of scope for this bead.
 */

/** `revisionMetadataV1Schema` — the release identity every response carries. */
export interface RevisionMetadataV1 {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
}

/** `bootstrapResponseV1Schema` — the `/v1/bootstrap` wire body (projection). */
export interface BootstrapResponseV1 {
  readonly apiVersion: 'v1';
  readonly minSupportedApiVersion: 'v1';
  readonly deprecationWindowDays: number;
  readonly activeRelease: RevisionMetadataV1;
  readonly searchIndexVersion?: string;
  readonly contentVersion?: string;
}

/**
 * A content-addressed artifact reference as declared in the fuller
 * `MobileBootstrapManifest.artifactHashes` (MOB-005). The `/v1/bootstrap`
 * projection does not carry these, but the downloadable manifest artifact does,
 * and artifact verification (§5) checks a freshly-fetched artifact's bytes
 * against the declared `hash`.
 */
export interface ManifestArtifactHashRef {
  readonly path: string;
  /** Lowercase hex sha-256 digest of the canonical artifact bytes. */
  readonly hash: string;
  readonly byteLength: number;
}

/**
 * The subset of the release manifest the client actually needs to invalidate
 * and verify its cache. The authoritative `releaseStamp` is
 * `<releaseId>@<first 12 hex of manifest identity hash>` (see mobile-bootstrap.ts
 * `deriveReleaseStamp`) — the client treats it as an opaque string and only ever
 * compares it for equality (never parses it).
 */
export interface ReleaseManifestView {
  readonly releaseStamp: string;
  readonly activeRelease: RevisionMetadataV1;
  readonly artifactHashes: Readonly<Record<string, ManifestArtifactHashRef>>;
  readonly degradedMode: boolean;
}

/** Minimal entity projection shape (entity.ts) — cached as an opaque JSON blob. */
export interface EntityV1 {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly revision: RevisionMetadataV1;
  // ...remaining fields carried verbatim as opaque JSON; the cache does not
  // interpret them, so we do not re-declare the full shape here.
  readonly [key: string]: unknown;
}

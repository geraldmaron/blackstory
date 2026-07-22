/**
 * Mobile cold-start bootstrap manifest (MOB-005 — completes the release-activation integration
 * ADR-013 describes but does not implement).
 *
 * This is the SERVER-SIDE artifact that becomes an immutable, release-scoped, content-addressed
 * part of a publication release (see `./release-activation.ts`). The `/v1/bootstrap` handler in
 * `apps/api-public` (already built) reads an active-release *pointer* — `{ activeRelease:
 * RevisionMetadataV1, searchIndexVersion?, contentVersion? }` — and projects a subset of it into
 * its wire response (`bootstrapResponseV1Schema` in `@repo/public-contracts`). `toReleasePointer`
 * below produces EXACTLY that pointer shape from this fuller manifest, so this module never
 * invents a competing wire contract: the manifest is the source of truth, the endpoint's response
 * is a projection of it. The extra fields this manifest carries (schema range, feature flags,
 * legal versions, artifact hashes, degraded-mode flag, cache directives) are the release-coupled
 * facts the client also needs but which live in the downloadable manifest artifact rather than
 * being re-derived per request.
 *
 * Determinism: given identical inputs this produces a byte-identical manifest (see
 * `canonicalJson`), so its hash — and therefore the release stamp — is stable across regenerations.
 * This module deliberately reads NO wall clock; `generatedAt` is always an explicit input, so a
 * clock-skewed server can never mint a different stamp for the same content.
 */
import { canonicalJson, sha256Bytes, type JsonValue, type Sha256Hash } from './index.js';

/**
 * `apps/api-public`'s `RevisionMetadataV1` / `ReleasePointer.activeRelease` shape, restated
 * structurally so `@repo/domain` takes no dependency on `@repo/public-contracts` (the client/server
 * boundary of ADR-021 runs the other way). Kept field-for-field identical to
 * `revisionMetadataV1Schema`; `release-activation` tests assert compatibility.
 */
export type ReleaseRevisionMetadata = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
};

/** Inclusive range of on-disk artifact schema versions this release's artifacts conform to. */
export type MobileSchemaRange = {
  readonly min: number;
  readonly max: number;
};

/**
 * App/API compatibility policy (ADR-021 §2). `minSupportedApiVersion`/`apiVersion` mirror the
 * URL-prefix major version and are the values the `/v1/bootstrap` response echoes;
 * `minSupportedAppBuild` is the app-version floor — the numeric store build below which a client
 * must force-update (the operational policy the `X-BlackStory-Client` header floor enforces).
 */
export type MobileCompatibilityPolicy = {
  readonly apiVersion: string;
  readonly minSupportedApiVersion: string;
  readonly deprecationWindowDays: number;
  readonly minSupportedAppBuild: number;
};

export type MobileFeatureFlags = Readonly<Record<string, boolean>>;

/** Version identifiers for each legal document the client must surface (privacy, terms, …). */
export type MobileLegalVersions = Readonly<Record<string, string>>;

/** A content-addressed reference to one release artifact carried in the manifest. */
export type MobileArtifactHashRef = {
  readonly path: string;
  readonly hash: Sha256Hash;
  readonly byteLength: number;
};

/**
 * Cache directives the client and CDN apply. Release artifacts are immutable, so they are
 * cached long/immutable; the bootstrap pointer itself is short-TTL + stale-while-revalidate so a
 * new release is picked up promptly without a cold start.
 */
export type MobileCacheDirectives = {
  readonly bootstrapMaxAgeSeconds: number;
  readonly bootstrapStaleWhileRevalidateSeconds: number;
  readonly releaseArtifactImmutableMaxAgeSeconds: number;
};

export type MobileBootstrapManifest = {
  readonly schemaVersion: 1;
  /**
   * The one value the client compares against its cached stamp to decide global cache
   * invalidation (ADR-022 §4). Content-derived (`releaseId@<manifestHashPrefix>`), never
   * clock-derived, so an identical stamp is a strong "identical content" guarantee and a
   * mismatch is the authoritative freshness signal regardless of TTL or clock skew.
   */
  readonly releaseStamp: string;
  readonly activeRelease: ReleaseRevisionMetadata;
  readonly schemaRange: MobileSchemaRange;
  readonly compatibility: MobileCompatibilityPolicy;
  readonly featureFlags: MobileFeatureFlags;
  readonly legalVersions: MobileLegalVersions;
  /** Every release-coupled aggregate artifact the client may fetch, by logical name. */
  readonly artifactHashes: Readonly<Record<string, MobileArtifactHashRef>>;
  /** True when this release is being served as a degraded/last-known-good snapshot. */
  readonly degradedMode: boolean;
  readonly cacheDirectives: MobileCacheDirectives;
  readonly searchIndexVersion?: string;
  readonly contentVersion?: string;
};

export type BuildMobileBootstrapManifestInput = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt?: string;
  readonly schemaRange: MobileSchemaRange;
  readonly compatibility: MobileCompatibilityPolicy;
  readonly featureFlags: MobileFeatureFlags;
  readonly legalVersions: MobileLegalVersions;
  readonly artifactHashes: Readonly<Record<string, MobileArtifactHashRef>>;
  readonly cacheDirectives: MobileCacheDirectives;
  readonly degradedMode?: boolean;
  readonly searchIndexVersion?: string;
  readonly contentVersion?: string;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

function assertValidRange(range: MobileSchemaRange): void {
  if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 1 || range.max < range.min) {
    throw new Error('schemaRange must be integers with 1 <= min <= max');
  }
}

/**
 * Serializes just the parts of a manifest that define its identity (everything except the
 * self-referential `releaseStamp`) so the stamp can be derived without a chicken-and-egg cycle.
 */
function manifestIdentityJson(
  input: Omit<MobileBootstrapManifest, 'releaseStamp'>,
): JsonValue {
  const sortedArtifacts: Record<string, JsonValue> = {};
  for (const name of Object.keys(input.artifactHashes).sort()) {
    const ref = input.artifactHashes[name]!;
    sortedArtifacts[name] = {
      path: ref.path,
      hash: { algorithm: ref.hash.algorithm, digest: ref.hash.digest },
      byteLength: ref.byteLength,
    };
  }
  return {
    schemaVersion: input.schemaVersion,
    activeRelease: { ...input.activeRelease },
    schemaRange: { min: input.schemaRange.min, max: input.schemaRange.max },
    compatibility: { ...input.compatibility },
    featureFlags: { ...input.featureFlags },
    legalVersions: { ...input.legalVersions },
    artifactHashes: sortedArtifacts,
    degradedMode: input.degradedMode,
    cacheDirectives: { ...input.cacheDirectives },
    ...(input.searchIndexVersion !== undefined ? { searchIndexVersion: input.searchIndexVersion } : {}),
    ...(input.contentVersion !== undefined ? { contentVersion: input.contentVersion } : {}),
  };
}

/**
 * Derives the release stamp: `<releaseId>@<first 12 hex of the manifest identity hash>`. The
 * releaseId alone is enough to distinguish two releases (they are always minted with fresh ids),
 * but folding in the content hash makes the stamp defensively sensitive to any content difference
 * — a tampered or stale manifest that somehow reused an id would still stamp differently.
 */
export function deriveReleaseStamp(releaseId: string, identityHash: Sha256Hash): string {
  return `${releaseId}@${identityHash.digest.slice(0, 12)}`;
}

export function buildMobileBootstrapManifest(
  input: BuildMobileBootstrapManifestInput,
): MobileBootstrapManifest {
  if (!SAFE_ID.test(input.releaseId)) {
    throw new Error('releaseId is not a safe release identifier');
  }
  if (!Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error('generatedAt must be an ISO-compatible date');
  }
  assertValidRange(input.schemaRange);
  if (
    input.compatibility.deprecationWindowDays < 0 ||
    !Number.isInteger(input.compatibility.minSupportedAppBuild) ||
    input.compatibility.minSupportedAppBuild < 0
  ) {
    throw new Error('compatibility policy is invalid');
  }

  const identity: Omit<MobileBootstrapManifest, 'releaseStamp'> = {
    schemaVersion: 1,
    activeRelease: {
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      recordUpdatedAt: input.recordUpdatedAt ?? input.generatedAt,
    },
    schemaRange: input.schemaRange,
    compatibility: input.compatibility,
    featureFlags: input.featureFlags,
    legalVersions: input.legalVersions,
    artifactHashes: input.artifactHashes,
    degradedMode: input.degradedMode ?? false,
    cacheDirectives: input.cacheDirectives,
    ...(input.searchIndexVersion !== undefined ? { searchIndexVersion: input.searchIndexVersion } : {}),
    ...(input.contentVersion !== undefined ? { contentVersion: input.contentVersion } : {}),
  };

  const identityHash = sha256Bytes(canonicalJson(manifestIdentityJson(identity)));
  return Object.freeze({
    ...identity,
    releaseStamp: deriveReleaseStamp(input.releaseId, identityHash),
  });
}

/** The canonical JSON payload persisted as the `bootstrap.json` artifact and hashed for the manifest registry. */
export function bootstrapManifestToJson(manifest: MobileBootstrapManifest): JsonValue {
  return {
    ...(manifestIdentityJson(manifest) as Record<string, JsonValue>),
    releaseStamp: manifest.releaseStamp,
  };
}

// ---------------------------------------------------------------------------
// Projections + client-facing predicates
// ---------------------------------------------------------------------------

/** The exact `ReleasePointer` shape `apps/api-public`'s bootstrap handler consumes (ADR-021/004). */
export type BootstrapReleasePointer = {
  readonly activeRelease: ReleaseRevisionMetadata;
  readonly searchIndexVersion?: string;
  readonly contentVersion?: string;
};

/**
 * Projects the pointer the `/v1/bootstrap` handler reads. This is the ONLY sanctioned bridge
 * between this manifest and the wire contract — the handler then re-echoes `apiVersion` /
 * `minSupportedApiVersion` / `deprecationWindowDays` from its own compiled constants, which this
 * manifest's `compatibility` policy is kept consistent with.
 */
export function toReleasePointer(manifest: MobileBootstrapManifest): BootstrapReleasePointer {
  return {
    activeRelease: { ...manifest.activeRelease },
    ...(manifest.searchIndexVersion !== undefined ? { searchIndexVersion: manifest.searchIndexVersion } : {}),
    ...(manifest.contentVersion !== undefined ? { contentVersion: manifest.contentVersion } : {}),
  };
}

/**
 * ADR-022 §4 staleness check. Returns true when the client's last-seen stamp differs from the
 * server's current stamp — the client MUST then treat all release-coupled cache (entities,
 * evidence, search results, map GeoJSON) as invalid. An absent client stamp (first launch) is
 * treated as stale so nothing stale-by-default is ever trusted.
 */
export function isReleaseStampStale(
  clientStamp: string | undefined,
  serverStamp: string,
): boolean {
  return clientStamp !== serverStamp;
}

export type ClientCompatibility =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'app_build_below_floor' | 'api_version_unsupported' };

/**
 * ADR-021 §2 client-version floor evaluation. A client is incompatible when its app build is
 * below the manifest's `minSupportedAppBuild` floor, or when it speaks an API major version the
 * manifest no longer supports. Mirrors what the server enforces via the `X-BlackStory-Client`
 * header + `CLIENT_VERSION_UNSUPPORTED`; provided here so the release owner can reason about the
 * floor a release ships with.
 */
export function evaluateClientCompatibility(
  manifest: MobileBootstrapManifest,
  client: { readonly appBuild: number; readonly apiVersion: string },
): ClientCompatibility {
  if (client.appBuild < manifest.compatibility.minSupportedAppBuild) {
    return { ok: false, reason: 'app_build_below_floor' };
  }
  if (client.apiVersion !== manifest.compatibility.apiVersion) {
    return { ok: false, reason: 'api_version_unsupported' };
  }
  return { ok: true };
}

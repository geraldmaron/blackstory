/**
 * Immutable publication-release contracts, deterministic hashing, signed manifests,
 * snapshot layout, lifecycle rules, and public response metadata.
 */
import { createHash, sign as signBytes, verify as verifyBytes, type KeyLike } from 'node:crypto';

export * from './release-builder.js';
export * from './mobile-bootstrap.js';
export * from './release-activation.js';
export * from './public-render.js';

export const RELEASE_STATUSES = [
  'draft',
  'preview',
  'active',
  'superseded',
  'rolled_back',
] as const;

export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type Sha256Hash = {
  readonly algorithm: 'sha256';
  readonly digest: string;
};

export type ReleaseManifestEntry = {
  readonly entityId: string;
  readonly revision: string;
  readonly projectionPath: string;
  readonly projectionHash: Sha256Hash;
  readonly snapshotPath: string;
  readonly snapshotHash: Sha256Hash;
};

export type ReleaseManifest = {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly searchIndexVersion: string;
  readonly entries: readonly ReleaseManifestEntry[];
};

export type SignedReleaseManifest = {
  readonly manifest: ReleaseManifest;
  readonly manifestHash: Sha256Hash;
  readonly signature: {
    readonly algorithm: 'ecdsa-sha256';
    readonly keyId: string;
    readonly value: string;
  };
};

export type PublicationRelease = {
  readonly id: string;
  readonly status: ReleaseStatus;
  readonly signedManifest: SignedReleaseManifest;
  readonly searchIndexVersion: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly activatedAt?: string;
  readonly supersededAt?: string;
  readonly rolledBackAt?: string;
};

export type PublicReleaseMetadata = {
  readonly releaseId: string;
  readonly revision: string;
  readonly searchIndexVersion: string;
  readonly manifestHash: string;
};

export type PublicEntitySnapshot<T extends JsonValue = JsonValue> = {
  readonly schemaVersion: 1;
  readonly metadata: PublicReleaseMetadata;
  readonly entity: T;
};

export type ReleaseArtifact = {
  readonly entityId: string;
  readonly revision: string;
  readonly projection: JsonValue;
  readonly snapshot: JsonValue;
};

const SHA256_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const textEncoder = new TextEncoder();

function assertIsoDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-compatible date`);
  }
}

function assertSafePathSegment(value: string, field: string): void {
  if (!SAFE_PATH_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`${field} is not a safe storage path segment`);
  }
}

function canonicalize(value: JsonValue, ancestors: ReadonlySet<object>): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON does not support non-finite numbers');
    }
    return JSON.stringify(value);
  }
  if (ancestors.has(value)) {
    throw new Error('Canonical JSON does not support circular values');
  }

  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, nextAncestors)).join(',')}]`;
  }

  const record = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key]!, nextAncestors)}`)
    .join(',')}}`;
}

/** Produces stable JSON by recursively sorting object keys while preserving array order. */
export function canonicalJson(value: JsonValue): string {
  return canonicalize(value, new Set());
}

export function sha256Bytes(value: string | Uint8Array): Sha256Hash {
  return Object.freeze({
    algorithm: 'sha256' as const,
    digest: createHash('sha256').update(value).digest('hex'),
  });
}

export function sha256Json(value: JsonValue): Sha256Hash {
  return sha256Bytes(canonicalJson(value));
}

export function publicEntityProjectionPath(releaseId: string, entityId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  assertSafePathSegment(entityId, 'entityId');
  return `publicReleases/${releaseId}/entities/${entityId}`;
}

export function publicEntitySnapshotPath(releaseId: string, entityId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  assertSafePathSegment(entityId, 'entityId');
  return `public/releases/${releaseId}/entities/${entityId}.json`;
}

export { publicReleaseEntitiesListPath, publicReleaseSearchIndexPath } from './release-paths.js';
export {
  supabasePublicMediaUrl,
  gcsPublicMediaUrl,
  resolvePublicMediaUrl,
  PUBLIC_MEDIA_DEFAULTS,
} from './public-media-urls.js';
export type { PublicMediaUrlOptions } from './public-media-urls.js';

function manifestToJson(manifest: ReleaseManifest): JsonValue {
  return {
    schemaVersion: manifest.schemaVersion,
    releaseId: manifest.releaseId,
    generatedAt: manifest.generatedAt,
    searchIndexVersion: manifest.searchIndexVersion,
    entries: manifest.entries.map((entry) => ({
      entityId: entry.entityId,
      revision: entry.revision,
      projectionPath: entry.projectionPath,
      projectionHash: { ...entry.projectionHash },
      snapshotPath: entry.snapshotPath,
      snapshotHash: { ...entry.snapshotHash },
    })),
  };
}

/**
 * Builds an unsigned manifest from already-public projection and snapshot payloads.
 * Callers must serialize through @repo/security before supplying artifacts.
 */
export function buildReleaseManifest(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly searchIndexVersion: string;
  readonly artifacts: readonly ReleaseArtifact[];
}): ReleaseManifest {
  assertSafePathSegment(input.releaseId, 'releaseId');
  assertSafePathSegment(input.searchIndexVersion, 'searchIndexVersion');
  assertIsoDate(input.generatedAt, 'generatedAt');
  const entityIds = new Set<string>();
  const entries = [...input.artifacts]
    .sort((left, right) => left.entityId.localeCompare(right.entityId))
    .map((artifact) => {
      assertSafePathSegment(artifact.entityId, 'entityId');
      if (!artifact.revision) {
        throw new Error('revision is required');
      }
      if (entityIds.has(artifact.entityId)) {
        throw new Error(`Duplicate manifest entity: ${artifact.entityId}`);
      }
      entityIds.add(artifact.entityId);
      return Object.freeze({
        entityId: artifact.entityId,
        revision: artifact.revision,
        projectionPath: publicEntityProjectionPath(input.releaseId, artifact.entityId),
        projectionHash: sha256Json(artifact.projection),
        snapshotPath: publicEntitySnapshotPath(input.releaseId, artifact.entityId),
        snapshotHash: sha256Json(artifact.snapshot),
      });
    });

  return Object.freeze({
    schemaVersion: 1 as const,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    searchIndexVersion: input.searchIndexVersion,
    entries: Object.freeze(entries),
  });
}

export function signReleaseManifest(
  manifest: ReleaseManifest,
  input: { readonly keyId: string; readonly privateKey: KeyLike },
): SignedReleaseManifest {
  if (!input.keyId) {
    throw new Error('keyId is required');
  }
  const manifestJson = canonicalJson(manifestToJson(manifest));
  const manifestHash = sha256Bytes(manifestJson);
  const signature = signBytes(
    'sha256',
    textEncoder.encode(manifestJson),
    input.privateKey,
  ).toString('base64');
  return Object.freeze({
    manifest,
    manifestHash,
    signature: Object.freeze({
      algorithm: 'ecdsa-sha256' as const,
      keyId: input.keyId,
      value: signature,
    }),
  });
}

export function verifySignedReleaseManifest(
  signedManifest: SignedReleaseManifest,
  publicKey: KeyLike,
): boolean {
  if (
    signedManifest.manifestHash.algorithm !== 'sha256' ||
    !SHA256_DIGEST_PATTERN.test(signedManifest.manifestHash.digest) ||
    signedManifest.signature.algorithm !== 'ecdsa-sha256'
  ) {
    return false;
  }
  const manifestJson = canonicalJson(manifestToJson(signedManifest.manifest));
  if (sha256Bytes(manifestJson).digest !== signedManifest.manifestHash.digest) {
    return false;
  }
  return verifyBytes(
    'sha256',
    textEncoder.encode(manifestJson),
    publicKey,
    Buffer.from(signedManifest.signature.value, 'base64'),
  );
}

export function createPublicationRelease(input: PublicationRelease): PublicationRelease {
  assertSafePathSegment(input.id, 'releaseId');
  assertIsoDate(input.createdAt, 'createdAt');
  if (input.id !== input.signedManifest.manifest.releaseId) {
    throw new Error('Release id must match its signed manifest');
  }
  if (input.searchIndexVersion !== input.signedManifest.manifest.searchIndexVersion) {
    throw new Error('Search-index version must match its signed manifest');
  }
  return Object.freeze({ ...input });
}

export function canTransitionRelease(from: ReleaseStatus, to: ReleaseStatus): boolean {
  const transitions: Readonly<Record<ReleaseStatus, ReadonlySet<ReleaseStatus>>> = {
    draft: new Set(['preview']),
    preview: new Set(['active']),
    active: new Set(['superseded', 'rolled_back']),
    superseded: new Set(['active']),
    rolled_back: new Set(['active']),
  };
  return transitions[from].has(to);
}

export function assertPubliclyReadableRelease(release: PublicationRelease): void {
  if (release.status !== 'active') {
    throw new Error(`Release ${release.id} is not active and cannot serve public traffic`);
  }
}

export function publicReleaseMetadata(
  release: PublicationRelease,
  revision: string,
): PublicReleaseMetadata {
  assertPubliclyReadableRelease(release);
  if (!revision) {
    throw new Error('revision is required');
  }
  return Object.freeze({
    releaseId: release.id,
    revision,
    searchIndexVersion: release.searchIndexVersion,
    manifestHash: release.signedManifest.manifestHash.digest,
  });
}

export function createPublicEntitySnapshot<T extends JsonValue>(
  release: PublicationRelease,
  revision: string,
  entity: T,
): PublicEntitySnapshot<T> {
  return Object.freeze({
    schemaVersion: 1 as const,
    metadata: publicReleaseMetadata(release, revision),
    entity,
  });
}

export {
  ReleaseActivationError,
  activateRelease,
  collectGarbage,
  createInMemoryReleaseStore,
  generateReleaseArtifacts,
  rollbackTo,
  sealArtifact,
  validateGeneratedArtifacts,
} from './release-activation.js';
export type {
  ActiveReleasePointer,
  ActivationResult,
  BoundedPointsBudget,
  ContentIndexEntry,
  GeneratedArtifact,
  GeneratedRelease,
  GenerateReleaseArtifactsInput,
  GcOptions,
  GcResult,
  ReleaseArtifactKind,
  ReleaseErrorCode,
  ReleaseStore,
  RollbackOptions,
  StoredArtifact,
  StoredRelease,
} from './release-activation.js';
export {
  buildMobileBootstrapManifest,
  bootstrapManifestToJson,
} from './mobile-bootstrap.js';
export type {
  BuildMobileBootstrapManifestInput,
  MobileArtifactHashRef,
  MobileBootstrapManifest,
} from './mobile-bootstrap.js';
export {
  publicReleaseBootstrapPath,
  publicReleaseBoundedPointsPath,
  publicReleaseContentIndexPath,
  publicReleaseMapCountyAggregatesPath,
  publicReleaseMapSourcePath,
  publicReleaseMapStateAggregatesPath,
} from './release-paths.js';

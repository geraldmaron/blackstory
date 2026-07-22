/**
 * Release-activation state machine (MOB-005 — completes the release-activation integration that
 * ADR-013 ("Release-coupled build"), `workers/publication/MAP_SOURCE_INTEGRATION.md`, and ADR-004
 * describe as designed-but-not-wired).
 *
 * Responsibilities, all fail-closed:
 *  - GENERATE every release-coupled aggregate artifact deterministically from one release's inputs:
 *    the map source + presence aggregates (via `buildMapSource`, which redacts transitively), a
 *    bounded flat-point artifact under a size/gzip budget, a content index, and the mobile
 *    bootstrap manifest (via `buildMobileBootstrapManifest`) that hashes them all.
 *  - VALIDATE every artifact's content hash before anything is persisted, and prove the manifest's
 *    declared hashes all resolve (no missing/partial artifact).
 *  - PERSIST artifacts immutably and content-addressed — an existing artifact at a path may only be
 *    re-written with byte-identical content; a different-content overwrite is refused.
 *  - ACTIVATE by flipping exactly ONE pointer, and only after all validation + persistence
 *    succeeds, via compare-and-set so concurrent/duplicate activations resolve to a single winner.
 *  - ROLL BACK to a prior release by re-validating its still-present artifacts and flipping the
 *    single pointer — restoring every artifact hash consistently, never a mix.
 *  - GARBAGE-COLLECT old releases while structurally refusing to delete the active or the
 *    immediately-previous (rollback-target) release.
 *
 * The `ReleaseStore` is the seam a real Firebase/GCP adapter implements; `createInMemoryReleaseStore`
 * is a complete, tested reference implementation used by the sandbox tests here. Emulator-backed
 * integration and real CDN cache-header verification are deferred to MOB-021's launch gate.
 */
import { gzipSync } from 'node:zlib';
import {
  buildMapSource,
  type BuildMapSourceInput,
  type MapSourceEntityInput,
  type MapRedactLocationFn,
} from '../map/map-source.js';
import {
  buildMobileBootstrapManifest,
  bootstrapManifestToJson,
  type BuildMobileBootstrapManifestInput,
  type MobileArtifactHashRef,
  type MobileBootstrapManifest,
} from './mobile-bootstrap.js';
import {
  publicReleaseBootstrapPath,
  publicReleaseBoundedPointsPath,
  publicReleaseContentIndexPath,
  publicReleaseEntitiesListPath,
  publicReleaseMapCountyAggregatesPath,
  publicReleaseMapSourcePath,
  publicReleaseMapStateAggregatesPath,
  publicReleaseSearchIndexPath,
} from './release-paths.js';
import { canonicalJson, sha256Bytes, type JsonValue, type Sha256Hash } from './index.js';

// ---------------------------------------------------------------------------
// Errors — every failure mode is a distinct, typed, fail-closed error.
// ---------------------------------------------------------------------------

export type ReleaseErrorCode =
  | 'RELEASE_VALIDATION'
  | 'IMMUTABLE_ARTIFACT_VIOLATION'
  | 'MISSING_ARTIFACT'
  | 'MISSING_RELEASE'
  | 'CONCURRENT_ACTIVATION'
  | 'ROLLBACK_SCHEMA_INCOMPATIBLE'
  | 'BUDGET_EXCEEDED'
  | 'PROTECTED_RELEASE';

export class ReleaseActivationError extends Error {
  readonly code: ReleaseErrorCode;
  constructor(code: ReleaseErrorCode, message: string) {
    super(message);
    this.name = 'ReleaseActivationError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Artifact model
// ---------------------------------------------------------------------------

export type ReleaseArtifactKind =
  | 'bootstrap'
  | 'map-source'
  | 'map-state-aggregates'
  | 'map-county-aggregates'
  | 'bounded-points'
  | 'content-index'
  | 'entities-list'
  | 'search-index';

export type GeneratedArtifact = {
  readonly kind: ReleaseArtifactKind;
  readonly path: string;
  readonly json: JsonValue;
  /** Canonical serialization the hash + byte counts are taken over. */
  readonly canonical: string;
  readonly hash: Sha256Hash;
  readonly byteLength: number;
  readonly gzipByteLength: number;
};

const utf8 = new TextEncoder();

/** Seals one artifact: canonicalizes, hashes, and measures raw + gzip byte size deterministically. */
export function sealArtifact(
  kind: ReleaseArtifactKind,
  path: string,
  json: JsonValue,
): GeneratedArtifact {
  const canonical = canonicalJson(json);
  const bytes = utf8.encode(canonical);
  return Object.freeze({
    kind,
    path,
    json,
    canonical,
    hash: sha256Bytes(canonical),
    byteLength: bytes.length,
    // Fixed gzip level so the measured compressed size is deterministic across runs/machines.
    gzipByteLength: gzipSync(bytes, { level: 9 }).length,
  });
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type ContentIndexEntry = {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly version: string;
};

export type BoundedPointsBudget = {
  readonly maxBytes: number;
  readonly maxGzipBytes: number;
};

export const DEFAULT_BOUNDED_POINTS_BUDGET: BoundedPointsBudget = Object.freeze({
  // Conservative launch ceilings for a single downloaded-once mobile artifact.
  maxBytes: 5_000_000,
  maxGzipBytes: 1_500_000,
});

export type GenerateReleaseArtifactsInput = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly recordUpdatedAt?: string;
  /** RAW (pre-redaction) entities; every coordinate is redacted by `redactLocation` before output. */
  readonly mapEntities: readonly MapSourceEntityInput[];
  /** Wire to `redactLocationForPublic` from `@repo/security`. */
  readonly redactLocation: MapRedactLocationFn;
  readonly contentIndex: readonly ContentIndexEntry[];
  /** Already-public aggregate entities.json (built by the per-entity release builder upstream). */
  readonly entitiesList: JsonValue;
  /** Already-public aggregate search-index.json. */
  readonly searchIndex: JsonValue;
  readonly bootstrap: Omit<
    BuildMobileBootstrapManifestInput,
    'releaseId' | 'generatedAt' | 'recordUpdatedAt' | 'artifactHashes'
  >;
  readonly budget?: BoundedPointsBudget;
};

export type GeneratedRelease = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly manifest: MobileBootstrapManifest;
  /** All artifacts including the bootstrap manifest itself, ordered deterministically by path. */
  readonly artifacts: readonly GeneratedArtifact[];
  readonly sizeReport: readonly {
    readonly kind: ReleaseArtifactKind;
    readonly byteLength: number;
    readonly gzipByteLength: number;
  }[];
};

/** Strips map features to the minimal fields the mobile map needs — coordinates are already redacted. */
function toBoundedPoints(mapSource: ReturnType<typeof buildMapSource>): JsonValue {
  return {
    schemaVersion: 1,
    releaseId: mapSource.releaseId,
    type: 'FeatureCollection',
    features: mapSource.featureCollection.features.map((feature) => ({
      id: feature.id,
      k: feature.properties.kind,
      c: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
    })),
  };
}

/**
 * Deterministically generates every release-coupled artifact + the bootstrap manifest. Given the
 * same inputs it returns byte-identical artifacts and hashes. Fails closed if the bounded-point
 * payload exceeds its size/gzip budget (an oversized flat GeoJSON must never become a release).
 */
export function generateReleaseArtifacts(input: GenerateReleaseArtifactsInput): GeneratedRelease {
  const { releaseId, generatedAt } = input;
  const mapInput: BuildMapSourceInput = {
    releaseId,
    generatedAt,
    entities: input.mapEntities,
    redactLocation: input.redactLocation,
  };
  const mapSource = buildMapSource(mapInput);

  const mapSourceArtifact = sealArtifact('map-source', publicReleaseMapSourcePath(releaseId), {
    schemaVersion: mapSource.schemaVersion,
    releaseId: mapSource.releaseId,
    generatedAt: mapSource.generatedAt,
    featureCollection: mapSource.featureCollection as unknown as JsonValue,
    meta: { ...mapSource.meta },
  });
  const stateAggArtifact = sealArtifact(
    'map-state-aggregates',
    publicReleaseMapStateAggregatesPath(releaseId),
    { releaseId, aggregates: mapSource.stateAggregates as unknown as JsonValue },
  );
  const countyAggArtifact = sealArtifact(
    'map-county-aggregates',
    publicReleaseMapCountyAggregatesPath(releaseId),
    { releaseId, aggregates: mapSource.countyAggregates as unknown as JsonValue },
  );

  const boundedPointsArtifact = sealArtifact(
    'bounded-points',
    publicReleaseBoundedPointsPath(releaseId),
    toBoundedPoints(mapSource),
  );
  const budget = input.budget ?? DEFAULT_BOUNDED_POINTS_BUDGET;
  if (
    boundedPointsArtifact.byteLength > budget.maxBytes ||
    boundedPointsArtifact.gzipByteLength > budget.maxGzipBytes
  ) {
    throw new ReleaseActivationError(
      'BUDGET_EXCEEDED',
      `bounded-points artifact exceeds budget (raw ${boundedPointsArtifact.byteLength}B / ` +
        `${budget.maxBytes}B, gzip ${boundedPointsArtifact.gzipByteLength}B / ${budget.maxGzipBytes}B)`,
    );
  }

  const contentArtifact = sealArtifact('content-index', publicReleaseContentIndexPath(releaseId), {
    schemaVersion: 1,
    releaseId,
    entries: [...input.contentIndex]
      .map((entry) => ({ id: entry.id, kind: entry.kind, title: entry.title, version: entry.version }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
  const entitiesListArtifact = sealArtifact(
    'entities-list',
    publicReleaseEntitiesListPath(releaseId),
    input.entitiesList,
  );
  const searchIndexArtifact = sealArtifact(
    'search-index',
    publicReleaseSearchIndexPath(releaseId),
    input.searchIndex,
  );

  const hashed: readonly GeneratedArtifact[] = [
    mapSourceArtifact,
    stateAggArtifact,
    countyAggArtifact,
    boundedPointsArtifact,
    contentArtifact,
    entitiesListArtifact,
    searchIndexArtifact,
  ];

  const artifactHashes: Record<string, MobileArtifactHashRef> = {};
  for (const artifact of hashed) {
    artifactHashes[artifact.kind] = {
      path: artifact.path,
      hash: artifact.hash,
      byteLength: artifact.byteLength,
    };
  }

  const manifest = buildMobileBootstrapManifest({
    releaseId,
    generatedAt,
    ...(input.recordUpdatedAt !== undefined ? { recordUpdatedAt: input.recordUpdatedAt } : {}),
    artifactHashes,
    ...input.bootstrap,
  });

  const bootstrapArtifact = sealArtifact(
    'bootstrap',
    publicReleaseBootstrapPath(releaseId),
    bootstrapManifestToJson(manifest),
  );

  const artifacts = [...hashed, bootstrapArtifact].sort((a, b) => a.path.localeCompare(b.path));

  return Object.freeze({
    releaseId,
    generatedAt,
    manifest,
    artifacts,
    sizeReport: artifacts.map((a) => ({
      kind: a.kind,
      byteLength: a.byteLength,
      gzipByteLength: a.gzipByteLength,
    })),
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type ActiveReleasePointer = {
  readonly activeReleaseId: string;
  /** The rollback target — the release that was active immediately before this one. */
  readonly previousReleaseId?: string;
  readonly releaseStamp: string;
  readonly bootstrapPath: string;
  readonly activatedAt: string;
  /** Monotonic counter; the compare-and-set key that serializes activations. */
  readonly pointerVersion: number;
};

export type StoredArtifact = {
  readonly hash: Sha256Hash;
  readonly canonical: string;
  readonly byteLength: number;
};

export type StoredRelease = {
  readonly releaseId: string;
  readonly manifest: MobileBootstrapManifest;
  readonly artifactPaths: readonly string[];
};

export interface ReleaseStore {
  /** Immutable, content-addressed write: an existing path may only be re-written byte-identically. */
  putArtifact(artifact: GeneratedArtifact): void;
  getArtifact(path: string): StoredArtifact | undefined;
  putRelease(release: StoredRelease): void;
  getRelease(releaseId: string): StoredRelease | undefined;
  listReleaseIds(): readonly string[];
  deleteRelease(releaseId: string): void;
  getPointer(): ActiveReleasePointer | undefined;
  /** Compare-and-set the single pointer; throws CONCURRENT_ACTIVATION if `expectedVersion` is stale. */
  flipPointer(next: ActiveReleasePointer, expectedVersion: number): void;
}

export function createInMemoryReleaseStore(): ReleaseStore {
  const artifacts = new Map<string, StoredArtifact>();
  const releases = new Map<string, StoredRelease>();
  let pointer: ActiveReleasePointer | undefined;

  return {
    putArtifact(artifact) {
      const existing = artifacts.get(artifact.path);
      if (existing && existing.hash.digest !== artifact.hash.digest) {
        throw new ReleaseActivationError(
          'IMMUTABLE_ARTIFACT_VIOLATION',
          `Refusing to overwrite immutable artifact ${artifact.path} with different content`,
        );
      }
      artifacts.set(artifact.path, {
        hash: artifact.hash,
        canonical: artifact.canonical,
        byteLength: artifact.byteLength,
      });
    },
    getArtifact(path) {
      return artifacts.get(path);
    },
    putRelease(release) {
      releases.set(release.releaseId, release);
    },
    getRelease(releaseId) {
      return releases.get(releaseId);
    },
    listReleaseIds() {
      return [...releases.keys()];
    },
    deleteRelease(releaseId) {
      if (pointer && (releaseId === pointer.activeReleaseId || releaseId === pointer.previousReleaseId)) {
        throw new ReleaseActivationError(
          'PROTECTED_RELEASE',
          `Refusing to delete protected release ${releaseId} (active or rollback target)`,
        );
      }
      const release = releases.get(releaseId);
      if (!release) return;
      for (const path of release.artifactPaths) {
        artifacts.delete(path);
      }
      releases.delete(releaseId);
    },
    getPointer() {
      return pointer;
    },
    flipPointer(next, expectedVersion) {
      const current = pointer?.pointerVersion ?? 0;
      if (current !== expectedVersion) {
        throw new ReleaseActivationError(
          'CONCURRENT_ACTIVATION',
          `Pointer moved under this activation (expected v${expectedVersion}, found v${current})`,
        );
      }
      pointer = Object.freeze({ ...next });
    },
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Re-derives each artifact's hash from its content and rejects any drift (corrupted/tampered artifact). */
export function validateGeneratedArtifacts(generated: GeneratedRelease): void {
  for (const artifact of generated.artifacts) {
    const recomputed = sha256Bytes(canonicalJson(artifact.json));
    if (recomputed.digest !== artifact.hash.digest) {
      throw new ReleaseActivationError(
        'RELEASE_VALIDATION',
        `Artifact ${artifact.path} failed hash validation (declared ${artifact.hash.digest.slice(0, 12)}, ` +
          `recomputed ${recomputed.digest.slice(0, 12)})`,
      );
    }
  }
  // Every hash the manifest declares must resolve to a generated artifact with a matching hash.
  const byKind = new Map(generated.artifacts.map((a) => [a.kind, a] as const));
  for (const [name, ref] of Object.entries(generated.manifest.artifactHashes)) {
    const artifact = byKind.get(name as ReleaseArtifactKind);
    if (!artifact) {
      throw new ReleaseActivationError(
        'MISSING_ARTIFACT',
        `Manifest references artifact "${name}" that was not generated`,
      );
    }
    if (artifact.hash.digest !== ref.hash.digest) {
      throw new ReleaseActivationError(
        'RELEASE_VALIDATION',
        `Manifest hash for "${name}" does not match the generated artifact`,
      );
    }
  }
}

/** Confirms every artifact a stored release's manifest references is still present with a matching hash. */
function assertStoredReleaseIntact(store: ReleaseStore, release: StoredRelease): void {
  for (const [name, ref] of Object.entries(release.manifest.artifactHashes)) {
    const stored = store.getArtifact(ref.path);
    if (!stored) {
      throw new ReleaseActivationError(
        'MISSING_ARTIFACT',
        `Release ${release.releaseId} artifact "${name}" (${ref.path}) is missing from the store`,
      );
    }
    if (stored.hash.digest !== ref.hash.digest) {
      throw new ReleaseActivationError(
        'RELEASE_VALIDATION',
        `Release ${release.releaseId} artifact "${name}" hash drifted from its manifest`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Activation / rollback / GC
// ---------------------------------------------------------------------------

export type ActivationResult = {
  readonly pointer: ActiveReleasePointer;
  readonly releaseStamp: string;
};

export type ActivateOptions = {
  /** Override the compare-and-set base version to model two activations racing off the same pointer. */
  readonly expectedPointerVersion?: number;
};

/**
 * Activates a generated release: validate → persist immutably → flip ONE pointer via compare-and-set.
 * Any failure before the flip leaves the previously-active pointer untouched and fully valid; the
 * new release simply never activates. Concurrent/duplicate activations off the same base version
 * resolve to a single winner (the loser throws CONCURRENT_ACTIVATION cleanly, having only written
 * immutable content-addressed artifacts).
 */
export function activateRelease(
  store: ReleaseStore,
  generated: GeneratedRelease,
  options: ActivateOptions = {},
): ActivationResult {
  const base = store.getPointer();
  const expectedVersion = options.expectedPointerVersion ?? base?.pointerVersion ?? 0;

  // 1. Validate BEFORE any persistence or pointer change.
  validateGeneratedArtifacts(generated);

  // 2. Persist artifacts immutably (rejects a different-content overwrite of an existing path).
  for (const artifact of generated.artifacts) {
    store.putArtifact(artifact);
  }

  // 3. Register the release so rollback/GC can find its artifact set.
  store.putRelease({
    releaseId: generated.releaseId,
    manifest: generated.manifest,
    artifactPaths: generated.artifacts.map((a) => a.path),
  });

  // 4. Atomic single-pointer flip (only now does the release become active).
  const next: ActiveReleasePointer = {
    activeReleaseId: generated.releaseId,
    ...(base?.activeReleaseId !== undefined ? { previousReleaseId: base.activeReleaseId } : {}),
    releaseStamp: generated.manifest.releaseStamp,
    bootstrapPath: publicReleaseBootstrapPath(generated.releaseId),
    activatedAt: generated.generatedAt,
    pointerVersion: expectedVersion + 1,
  };
  store.flipPointer(next, expectedVersion);

  return { pointer: next, releaseStamp: next.releaseStamp };
}

export type RollbackOptions = {
  /** If set, refuse to roll back to a release whose schema range does not cover this version. */
  readonly platformSchemaVersion?: number;
  readonly expectedPointerVersion?: number;
};

/**
 * Rolls back to a prior release by re-validating its still-present artifacts and flipping the single
 * pointer. Restores every artifact hash consistently (the whole release, never a mix). Fails closed
 * if the target release was garbage-collected (MISSING_RELEASE), any of its artifacts are missing or
 * drifted, or a schema-migration guard rejects it.
 */
export function rollbackTo(
  store: ReleaseStore,
  targetReleaseId: string,
  options: RollbackOptions = {},
): ActivationResult {
  const target = store.getRelease(targetReleaseId);
  if (!target) {
    throw new ReleaseActivationError(
      'MISSING_RELEASE',
      `Cannot roll back to ${targetReleaseId}: release not found (garbage-collected or never activated)`,
    );
  }
  assertStoredReleaseIntact(store, target);

  if (options.platformSchemaVersion !== undefined) {
    const { min, max } = target.manifest.schemaRange;
    if (options.platformSchemaVersion < min || options.platformSchemaVersion > max) {
      throw new ReleaseActivationError(
        'ROLLBACK_SCHEMA_INCOMPATIBLE',
        `Refusing to roll back to ${targetReleaseId}: its schema range [${min}, ${max}] does not ` +
          `cover platform schema ${options.platformSchemaVersion} — would serve an incompatible shape`,
      );
    }
  }

  const base = store.getPointer();
  const expectedVersion = options.expectedPointerVersion ?? base?.pointerVersion ?? 0;
  const next: ActiveReleasePointer = {
    activeReleaseId: target.releaseId,
    ...(base?.activeReleaseId !== undefined ? { previousReleaseId: base.activeReleaseId } : {}),
    releaseStamp: target.manifest.releaseStamp,
    bootstrapPath: publicReleaseBootstrapPath(target.releaseId),
    activatedAt: target.manifest.activeRelease.generatedAt,
    pointerVersion: expectedVersion + 1,
  };
  store.flipPointer(next, expectedVersion);
  return { pointer: next, releaseStamp: next.releaseStamp };
}

export type GcOptions = {
  /** Extra release ids to retain beyond the active + previous (e.g. a pinned known-good). */
  readonly retain?: readonly string[];
};

export type GcResult = {
  readonly deleted: readonly string[];
  readonly retained: readonly string[];
};

/**
 * Deletes old releases and their artifacts while structurally protecting the active release and the
 * immediately-previous (rollback-target) release — the store itself also refuses to delete either,
 * so a GC bug cannot strand the rollback path.
 */
export function collectGarbage(store: ReleaseStore, options: GcOptions = {}): GcResult {
  const pointer = store.getPointer();
  const keep = new Set<string>(options.retain ?? []);
  if (pointer) {
    keep.add(pointer.activeReleaseId);
    if (pointer.previousReleaseId) {
      keep.add(pointer.previousReleaseId);
    }
  }
  const deleted: string[] = [];
  for (const releaseId of store.listReleaseIds()) {
    if (keep.has(releaseId)) continue;
    store.deleteRelease(releaseId);
    deleted.push(releaseId);
  }
  return { deleted, retained: [...keep] };
}

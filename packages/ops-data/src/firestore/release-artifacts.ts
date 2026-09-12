/**
 * Per-release public catalog artifacts (ADR-004): aggregate entities.json + search-index.json
 * under `public/releases/{releaseId}/`. Replaces unbounded Firestore collection scans for
 * map/list/search/history/sitemap once published to the public-media bucket (or a local
 * fixture directory for tests/dev).
 *
 * Fetching the published artifacts is shared with `apps/web` via `@repo/domain` (both consumers
 * used to carry their own copy, and they disagreed on fallback policy). This module adds one
 * thing on top of the shared fetcher: an opt-in local-fixture fallback for dev/test, gated by
 * `allowLocalFallback: true` — off by default, so `packages/ops-data/fixtures/release-artifacts`
 * can never shadow a live artifact just because a caller forgot to pass an option.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchReleaseEntitiesListArtifact as fetchSharedReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact as fetchSharedReleaseSearchIndexArtifact,
  sha256Json,
  supabasePublicMediaUrl,
  type ArtifactFetchImpl,
  type FetchReleaseArtifactOptions as SharedFetchReleaseArtifactOptions,
  type JsonValue,
  type ReleaseEntitiesListArtifact as SharedReleaseEntitiesListArtifact,
  type ReleaseSearchIndexArtifact as SharedReleaseSearchIndexArtifact,
  type Sha256Hash,
} from '@repo/domain';
import { DEFAULT_PUBLIC_MEDIA_BUCKET } from './entity-media.js';

export { DEFAULT_PUBLIC_MEDIA_BUCKET };

export const RELEASE_CATALOG_ARTIFACT_SCHEMA_VERSION = 1 as const;

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

function assertSafePathSegment(value: string, field: string): void {
  if (!SAFE_PATH_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`${field} is not a safe storage path segment`);
  }
}

/** Aggregate entities list object path (CDN / public-media). */
export function publicReleaseEntitiesListPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/entities.json`;
}

/** Aggregate search-index object path (CDN / public-media). */
export function publicReleaseSearchIndexPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/search-index.json`;
}

export type ReleaseEntitiesListArtifact = {
  readonly schemaVersion: typeof RELEASE_CATALOG_ARTIFACT_SCHEMA_VERSION;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly entityCount: number;
  readonly entities: readonly JsonValue[];
};

export type ReleaseSearchIndexArtifact = {
  readonly schemaVersion: typeof RELEASE_CATALOG_ARTIFACT_SCHEMA_VERSION;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly docCount: number;
  readonly docs: readonly JsonValue[];
};

export type BuiltReleaseCatalogArtifacts = {
  readonly entitiesList: ReleaseEntitiesListArtifact;
  readonly searchIndex: ReleaseSearchIndexArtifact;
  readonly entitiesListPath: string;
  readonly searchIndexPath: string;
  readonly entitiesListHash: Sha256Hash;
  readonly searchIndexHash: Sha256Hash;
};

export function buildReleaseCatalogArtifacts(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly projections: readonly JsonValue[];
  readonly searchDocs: readonly JsonValue[];
}): BuiltReleaseCatalogArtifacts {
  const entitiesList: ReleaseEntitiesListArtifact = {
    schemaVersion: RELEASE_CATALOG_ARTIFACT_SCHEMA_VERSION,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    entityCount: input.projections.length,
    entities: input.projections,
  };
  const searchIndex: ReleaseSearchIndexArtifact = {
    schemaVersion: RELEASE_CATALOG_ARTIFACT_SCHEMA_VERSION,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    docCount: input.searchDocs.length,
    docs: input.searchDocs,
  };
  return {
    entitiesList,
    searchIndex,
    entitiesListPath: publicReleaseEntitiesListPath(input.releaseId),
    searchIndexPath: publicReleaseSearchIndexPath(input.releaseId),
    entitiesListHash: sha256Json(entitiesList as unknown as JsonValue),
    searchIndexHash: sha256Json(searchIndex as unknown as JsonValue),
  };
}

/** HTTPS URL for a public-media object (Supabase Storage public bucket). */
export function publicMediaObjectUrl(
  objectPath: string,
  _options: { readonly bucket?: string } = {},
): string {
  return supabasePublicMediaUrl(objectPath.replace(/^\/+/, ''));
}

/**
 * Write both catalog artifacts as pretty JSON under `outputDir` (mirrors the GCS object keys
 * as relative paths). Returns absolute file paths written.
 */
export function writeReleaseCatalogArtifactsToDir(
  artifacts: BuiltReleaseCatalogArtifacts,
  outputDir: string,
): { readonly entitiesListFile: string; readonly searchIndexFile: string } {
  const entitiesListFile = join(outputDir, artifacts.entitiesListPath);
  const searchIndexFile = join(outputDir, artifacts.searchIndexPath);
  mkdirSync(dirname(entitiesListFile), { recursive: true });
  mkdirSync(dirname(searchIndexFile), { recursive: true });
  writeFileSync(entitiesListFile, `${JSON.stringify(artifacts.entitiesList, null, 2)}\n`, 'utf8');
  writeFileSync(searchIndexFile, `${JSON.stringify(artifacts.searchIndex, null, 2)}\n`, 'utf8');
  return { entitiesListFile, searchIndexFile };
}

/**
 * Upload catalog artifacts to the public-media bucket. Optional — publish scripts call this
 * when `APP_UPLOAD_RELEASE_ARTIFACTS=1` and ADC can write Storage.
 */
export async function uploadReleaseCatalogArtifacts(input: {
  readonly artifacts: BuiltReleaseCatalogArtifacts;
  readonly bucket?: string;
  readonly save: (objectPath: string, body: Buffer, contentType: string) => Promise<void>;
}): Promise<void> {
  const jsonType = 'application/json; charset=utf-8';
  await input.save(
    input.artifacts.entitiesListPath,
    Buffer.from(`${JSON.stringify(input.artifacts.entitiesList)}\n`, 'utf8'),
    jsonType,
  );
  await input.save(
    input.artifacts.searchIndexPath,
    Buffer.from(`${JSON.stringify(input.artifacts.searchIndex)}\n`, 'utf8'),
    jsonType,
  );
}

export type { ArtifactFetchImpl };

export type FetchReleaseArtifactOptions = SharedFetchReleaseArtifactOptions & {
  /**
   * Serve `packages/ops-data/fixtures/release-artifacts` when the remote fetch misses.
   * Opt-in and off by default: dev/test only, never assume it — a fixture slice must never
   * shadow live `bb_public` data because a caller forgot to pass an option.
   */
  readonly allowLocalFallback?: boolean;
  readonly localArtifactsRoot?: string;
};

function defaultLocalArtifactsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/release-artifacts');
}

function readLocalJsonArtifact<T>(objectPath: string, root: string): T | undefined {
  try {
    const raw = readFileSync(join(root, objectPath), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Fetch the release entities-list artifact (CDN HTTPS, optional opt-in local fixture fallback). */
export async function fetchReleaseEntitiesListArtifact(
  releaseId: string,
  options: FetchReleaseArtifactOptions = {},
): Promise<SharedReleaseEntitiesListArtifact | undefined> {
  const remote = await fetchSharedReleaseEntitiesListArtifact(releaseId, options);
  if (remote) return remote;
  if (options.allowLocalFallback !== true) return undefined;
  const objectPath = publicReleaseEntitiesListPath(releaseId);
  const localRoot = options.localArtifactsRoot ?? defaultLocalArtifactsRoot();
  const local = readLocalJsonArtifact<SharedReleaseEntitiesListArtifact>(objectPath, localRoot);
  if (local && local.releaseId === releaseId && Array.isArray(local.entities)) {
    return local;
  }
  return undefined;
}

/** Fetch the release search-index artifact (CDN HTTPS, optional opt-in local fixture fallback). */
export async function fetchReleaseSearchIndexArtifact(
  releaseId: string,
  options: FetchReleaseArtifactOptions = {},
): Promise<SharedReleaseSearchIndexArtifact | undefined> {
  const remote = await fetchSharedReleaseSearchIndexArtifact(releaseId, options);
  if (remote) return remote;
  if (options.allowLocalFallback !== true) return undefined;
  const objectPath = publicReleaseSearchIndexPath(releaseId);
  const localRoot = options.localArtifactsRoot ?? defaultLocalArtifactsRoot();
  const local = readLocalJsonArtifact<SharedReleaseSearchIndexArtifact>(objectPath, localRoot);
  if (local && local.releaseId === releaseId && Array.isArray(local.docs)) {
    return local;
  }
  return undefined;
}

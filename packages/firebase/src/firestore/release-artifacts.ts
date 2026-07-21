/**
 * Per-release public catalog artifacts (ADR-004): aggregate entities.json + search-index.json
 * under `public/releases/{releaseId}/`. Replaces unbounded Firestore collection scans for
 * map/list/search/history/sitemap once published to the public-media bucket (or a local
 * fixture directory for tests/dev).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Json, supabasePublicMediaUrl, type JsonValue, type Sha256Hash } from '@repo/domain';
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

export type ArtifactFetchImpl = (
  url: string,
  init?: { readonly signal?: AbortSignal },
) => Promise<Response>;

export type FetchReleaseArtifactOptions = {
  readonly fetchImpl?: ArtifactFetchImpl;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly allowLocalFallback?: boolean;
  readonly localArtifactsRoot?: string;
};

function artifactBaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const configured = env.APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL?.trim();
  if (configured && configured.length > 0) return configured.replace(/\/+$/, '');
  return undefined;
}

function remoteArtifactUrl(objectPath: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = artifactBaseUrl(env);
  if (base) return `${base}/${objectPath}`;
  return publicMediaObjectUrl(objectPath);
}

function defaultLocalArtifactsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/release-artifacts');
}

async function fetchJsonArtifact<T>(
  objectPath: string,
  options: FetchReleaseArtifactOptions = {},
): Promise<T | undefined> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const url = remoteArtifactUrl(objectPath, env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function readLocalJsonArtifact<T>(objectPath: string, root: string): T | undefined {
  try {
    const raw = readFileSync(join(root, objectPath), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Fetch the release search-index artifact (CDN/GCS HTTPS, optional local fixture fallback). */
export async function fetchReleaseSearchIndexArtifact(
  releaseId: string,
  options: FetchReleaseArtifactOptions = {},
): Promise<ReleaseSearchIndexArtifact | undefined> {
  const objectPath = publicReleaseSearchIndexPath(releaseId);
  const remote = await fetchJsonArtifact<ReleaseSearchIndexArtifact>(objectPath, options);
  if (remote && remote.releaseId === releaseId && Array.isArray(remote.docs)) {
    return remote;
  }
  if (options.allowLocalFallback === false) return undefined;
  const localRoot = options.localArtifactsRoot ?? defaultLocalArtifactsRoot();
  const local = readLocalJsonArtifact<ReleaseSearchIndexArtifact>(objectPath, localRoot);
  if (local && local.releaseId === releaseId && Array.isArray(local.docs)) {
    return local;
  }
  return undefined;
}

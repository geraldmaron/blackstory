/**
 * Fetches ADR-004 per-release catalog artifacts (entities.json / search-index.json).
 * Prefer CDN/GCS HTTPS; fall back to local publish fixtures for offline/dev.
 * Injected `fetchImpl` keeps unit tests free of network.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  publicMediaObjectUrl,
  publicReleaseEntitiesListPath,
  publicReleaseSearchIndexPath,
  type ReleaseEntitiesListArtifact,
  type ReleaseSearchIndexArtifact,
} from '@repo/firebase';

const LOCAL_ARTIFACTS_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../packages/firebase/fixtures/release-artifacts',
);

export type ArtifactFetchImpl = (
  url: string,
  init?: { readonly signal?: AbortSignal },
) => Promise<Response>;

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

async function fetchJsonArtifact<T>(
  objectPath: string,
  options: {
    readonly fetchImpl?: ArtifactFetchImpl;
    readonly env?: NodeJS.ProcessEnv;
    readonly timeoutMs?: number;
  } = {},
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

function readLocalJsonArtifact<T>(objectPath: string): T | undefined {
  try {
    const raw = readFileSync(join(LOCAL_ARTIFACTS_ROOT, objectPath), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function fetchReleaseEntitiesListArtifact(
  releaseId: string,
  options: {
    readonly fetchImpl?: ArtifactFetchImpl;
    readonly env?: NodeJS.ProcessEnv;
    readonly allowLocalFallback?: boolean;
  } = {},
): Promise<ReleaseEntitiesListArtifact | undefined> {
  const objectPath = publicReleaseEntitiesListPath(releaseId);
  const remote = await fetchJsonArtifact<ReleaseEntitiesListArtifact>(objectPath, options);
  if (remote && remote.releaseId === releaseId && Array.isArray(remote.entities)) {
    return remote;
  }
  if (options.allowLocalFallback === false) return undefined;
  const local = readLocalJsonArtifact<ReleaseEntitiesListArtifact>(objectPath);
  if (local && local.releaseId === releaseId && Array.isArray(local.entities)) {
    return local;
  }
  return undefined;
}

export async function fetchReleaseSearchIndexArtifact(
  releaseId: string,
  options: {
    readonly fetchImpl?: ArtifactFetchImpl;
    readonly env?: NodeJS.ProcessEnv;
    readonly allowLocalFallback?: boolean;
  } = {},
): Promise<ReleaseSearchIndexArtifact | undefined> {
  const objectPath = publicReleaseSearchIndexPath(releaseId);
  const remote = await fetchJsonArtifact<ReleaseSearchIndexArtifact>(objectPath, options);
  if (remote && remote.releaseId === releaseId && Array.isArray(remote.docs)) {
    return remote;
  }
  if (options.allowLocalFallback === false) return undefined;
  const local = readLocalJsonArtifact<ReleaseSearchIndexArtifact>(objectPath);
  if (local && local.releaseId === releaseId && Array.isArray(local.docs)) {
    return local;
  }
  return undefined;
}

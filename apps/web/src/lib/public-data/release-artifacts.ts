/**
 * Fetches versioned per-release catalog artifacts (entities.json / search-index.json).
 * The artifact origin is explicit; Postgres remains canonical when it is absent or unavailable.
 * Injected `fetchImpl` keeps unit tests free of network.
 */
export type ReleaseEntitiesListArtifact = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly entityCount: number;
  readonly entities: readonly unknown[];
};

export type ReleaseSearchIndexArtifact = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly docCount: number;
  readonly docs: readonly unknown[];
};

function publicReleaseEntitiesListPath(releaseId: string): string {
  return `public/releases/${encodeURIComponent(releaseId)}/entities.json`;
}

function publicReleaseSearchIndexPath(releaseId: string): string {
  return `public/releases/${encodeURIComponent(releaseId)}/search-index.json`;
}

export type ArtifactFetchImpl = (
  url: string,
  init?: { readonly signal?: AbortSignal },
) => Promise<Response>;

function artifactBaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const configured = env.APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL?.trim();
  if (configured && configured.length > 0) return configured.replace(/\/+$/, '');
  return undefined;
}

function remoteArtifactUrl(
  objectPath: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const base = artifactBaseUrl(env);
  if (base) return `${base}/${objectPath}`;
  return undefined;
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
  if (!url) return undefined;
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

export async function fetchReleaseEntitiesListArtifact(
  releaseId: string,
  options: {
    readonly fetchImpl?: ArtifactFetchImpl;
    readonly env?: NodeJS.ProcessEnv;
  } = {},
): Promise<ReleaseEntitiesListArtifact | undefined> {
  const objectPath = publicReleaseEntitiesListPath(releaseId);
  const remote = await fetchJsonArtifact<ReleaseEntitiesListArtifact>(objectPath, options);
  if (remote && remote.releaseId === releaseId && Array.isArray(remote.entities)) {
    return remote;
  }
  return undefined;
}

export async function fetchReleaseSearchIndexArtifact(
  releaseId: string,
  options: {
    readonly fetchImpl?: ArtifactFetchImpl;
    readonly env?: NodeJS.ProcessEnv;
  } = {},
): Promise<ReleaseSearchIndexArtifact | undefined> {
  const objectPath = publicReleaseSearchIndexPath(releaseId);
  const remote = await fetchJsonArtifact<ReleaseSearchIndexArtifact>(objectPath, options);
  if (remote && remote.releaseId === releaseId && Array.isArray(remote.docs)) {
    return remote;
  }
  return undefined;
}

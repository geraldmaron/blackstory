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

/**
 * Why this logs: every `undefined` returned here silently costs a full multi-MB Postgres
 * catalog pull upstream (`loadLiveEntitiesForRelease`). Before 2026-08-08 this path swallowed
 * timeouts, 404s and parse errors with a bare `catch {}`, so a persistently failing artifact
 * origin was indistinguishable from a healthy one — the only visible symptom was the DB egress
 * bill. Log lines are one-per-miss on the cold path (not per request); they are the signal that
 * tells you whether residual Postgres catalog reads are expected cold starts or a broken origin.
 */
function warnArtifactMiss(objectPath: string, reason: string): void {
  console.warn(`[public-data] release artifact miss (${reason}); falling back to Postgres`, {
    objectPath,
  });
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
  // Not a miss worth logging: no origin configured is a deliberate "Postgres only" posture.
  if (!url) return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAtMs = Date.now();
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      warnArtifactMiss(objectPath, `http ${response.status}`);
      return undefined;
    }
    const parsed = (await response.json()) as T;
    console.info(`[public-data] release artifact hit in ${Date.now() - startedAtMs}ms`, {
      objectPath,
    });
    return parsed;
  } catch (error) {
    const aborted = controller.signal.aborted;
    const message = error instanceof Error ? error.message : String(error);
    warnArtifactMiss(
      objectPath,
      aborted ? `timeout after ${timeoutMs}ms` : `fetch/parse failed: ${message}`,
    );
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
  if (remote) {
    // Fetched fine but unusable — a version-skewed artifact (publisher behind the active
    // release pointer) looks identical to a network failure from the caller's side.
    warnArtifactMiss(
      objectPath,
      `releaseId mismatch: artifact=${String(remote.releaseId)} active=${releaseId}`,
    );
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
  if (remote) {
    warnArtifactMiss(
      objectPath,
      `releaseId mismatch: artifact=${String(remote.releaseId)} active=${releaseId}`,
    );
  }
  return undefined;
}

/**
 * Shared fetcher for per-release public catalog artifacts (ADR-004): entities.json and
 * search-index.json under `public/releases/{releaseId}/`. The single implementation behind
 * both `apps/web`'s public data layer and `apps/api-public`'s read-through cache (via
 * `@repo/ops-data`) — two independently maintained copies previously disagreed on fallback
 * policy: one returned `undefined` with no configured origin, the other silently fell back to
 * the public-media CDN URL.
 *
 * Policy, canonical from here on:
 * - an artifact is fetched only when `APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL` names an explicit
 *   origin. There is no implicit fallback to the public-media CDN, so an unconfigured
 *   deployment can never start silently serving CDN objects it never opted into.
 * - a response whose `releaseId` doesn't match the requested one is treated as a miss — a
 *   version-skewed artifact (publisher behind the active release pointer) looks identical to a
 *   network failure from the caller's side, and the caller falls back to Postgres either way.
 * - every failure mode (no origin configured, non-2xx, timeout, parse error, release mismatch)
 *   returns `undefined`; this module never decides the fallback, callers do.
 *
 * This module does no filesystem I/O and has no local-fixture fallback — that stays an
 * ops-data-only, opt-in concern (`packages/ops-data/src/firestore/release-artifacts.ts`) layered
 * on top of these functions, so a forgotten argument here can never let a fixture slice shadow
 * live data.
 */
import { publicReleaseEntitiesListPath, publicReleaseSearchIndexPath } from './release-paths.js';

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

export type ArtifactFetchInit = {
  readonly signal?: AbortSignal;
  // Spelled out rather than the DOM lib's `RequestCache`: this package's tsconfig targets Node,
  // not the browser, so that global type isn't ambiently available here.
  readonly cache?:
    'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload';
  readonly next?: { readonly revalidate: number };
};

export type ArtifactFetchImpl = (url: string, init?: ArtifactFetchInit) => Promise<Response>;

export type FetchReleaseArtifactOptions = {
  readonly fetchImpl?: ArtifactFetchImpl;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
};

/**
 * Trailing slashes removed by scanning back from the end, not `replace(/\/+$/, '')`: that
 * expression is quadratic on input ending in a long run of slashes (CodeQL js/polynomial-redos),
 * and this value comes from environment configuration.
 */
function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function artifactBaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const configured = env.APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL?.trim();
  if (configured && configured.length > 0) return trimTrailingSlashes(configured);
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
 * catalog pull upstream. A persistently failing artifact origin is otherwise indistinguishable
 * from a healthy one that simply has nothing configured — the only visible symptom would be the
 * DB egress bill. Log lines are one-per-miss on the cold path (not per request); they are the
 * signal that tells you whether residual Postgres catalog reads are expected cold starts or a
 * broken origin.
 */
function warnArtifactMiss(objectPath: string, reason: string): void {
  console.warn(`[public-data] release artifact miss (${reason}); falling back to Postgres`, {
    objectPath,
  });
}

async function fetchJsonArtifact<T>(
  objectPath: string,
  options: FetchReleaseArtifactOptions = {},
): Promise<T | undefined> {
  const env = options.env ?? process.env;
  // Cast, not a structural fit: the global `fetch` this defaults to is typed against whatever
  // `RequestInit` its host project ambiently declares (Next.js augments it with `next`; a plain
  // Node project does not), which can differ from our own deliberately narrow `ArtifactFetchInit`.
  // The extra `next` field this module passes below is a no-op outside Next.js — undici ignores
  // unrecognized `RequestInit` properties rather than rejecting them.
  const fetchImpl: ArtifactFetchImpl = options.fetchImpl ?? (fetch as unknown as ArtifactFetchImpl);
  // 13.8 MB entities.json timed out at 8s on Vercel and fell back to the 968 ms
  // full-catalog SQL path. 60s covers a cold Storage GET.
  const timeoutMs = options.timeoutMs ?? 60_000;
  const url = remoteArtifactUrl(objectPath, env);
  // Not a miss worth logging: no origin configured is a deliberate "Postgres only" posture.
  if (!url) return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAtMs = Date.now();
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      cache: 'force-cache',
      next: { revalidate: 3600 },
    });
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
  options: FetchReleaseArtifactOptions = {},
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
  options: FetchReleaseArtifactOptions = {},
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

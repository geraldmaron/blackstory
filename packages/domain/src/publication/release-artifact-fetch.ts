/**
 * Shared fetcher for per-release public catalog artifacts (`docs/decisions-carryover.md`,
 * "Public projection and immutable publication snapshots"): entities.json and
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
 * ops-data-only, opt-in concern (`packages/ops-data/src/records/release-artifacts.ts`) layered
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
  readonly headers?: Readonly<Record<string, string>>;
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

/**
 * What this process last downloaded per object path, held so the next refresh can be a
 * conditional GET. Next's data cache refuses bodies over 2 MB and both artifacts exceed it, so
 * the `force-cache` this module used to pass never cached anything: every 30-minute
 * release-scoped refresh, on every function instance, re-downloaded 13.8 MB + 8.3 MB. Measured
 * 2026-09-22 at 4,239 downloads and 54 GB a day from ~30 instances at two requests a second
 * (`repo-ogo3j.2`). Storage answers `If-None-Match` with a bodiless 304, so a refresh whose
 * artifact has not changed now costs a round trip and nothing else. A republished artifact
 * (a new release, or an in-place correction under the same release id) changes the ETag and
 * comes back as a full 200, which keeps correction staleness bounded by the caller's TTL.
 *
 * Bounded to a handful of entries: paths are per release, two per release, and a process only
 * ever serves the active one plus whatever it saw before a pointer moved.
 */
type ArtifactMemoEntry = { readonly etag: string; readonly value: unknown };
const ARTIFACT_MEMO_MAX_ENTRIES = 4;
const artifactMemo = new Map<string, ArtifactMemoEntry>();

function rememberArtifact(objectPath: string, entry: ArtifactMemoEntry): void {
  artifactMemo.delete(objectPath);
  artifactMemo.set(objectPath, entry);
  while (artifactMemo.size > ARTIFACT_MEMO_MAX_ENTRIES) {
    const oldest = artifactMemo.keys().next().value;
    if (oldest === undefined) break;
    artifactMemo.delete(oldest);
  }
}

/** Test seam: forget every remembered artifact so cases do not see each other's ETags. */
export function __resetReleaseArtifactMemoForTests(): void {
  artifactMemo.clear();
}

/**
 * Request headers for an artifact GET. Storage serves brotli only when asked, and the 2026-09-22
 * Supabase edge logs showed the function runtime's fetch arriving with no `accept-encoding`:
 * every response carried `content-length: 8310554`, the identity size of a search index that is
 * 1.2 MB compressed. Asking explicitly is what makes undici decompress on the way in.
 */
function artifactRequestHeaders(remembered: ArtifactMemoEntry | undefined) {
  return {
    accept: 'application/json',
    'accept-encoding': 'br, gzip',
    ...(remembered ? { 'if-none-match': remembered.etag } : {}),
  } as const;
}

async function fetchJsonArtifact<T>(
  objectPath: string,
  options: FetchReleaseArtifactOptions = {},
): Promise<T | undefined> {
  const env = options.env ?? process.env;
  // Cast, not a structural fit: the global `fetch` this defaults to is typed against whatever
  // `RequestInit` its host project ambiently declares (Next.js augments it with `next`; a plain
  // Node project does not), which can differ from our own deliberately narrow `ArtifactFetchInit`.
  const fetchImpl: ArtifactFetchImpl = options.fetchImpl ?? (fetch as unknown as ArtifactFetchImpl);
  // 13.8 MB entities.json timed out at 8s on Vercel and fell back to the 968 ms
  // full-catalog SQL path. 60s covers a cold Storage GET.
  const timeoutMs = options.timeoutMs ?? 60_000;
  const url = remoteArtifactUrl(objectPath, env);
  // Not a miss worth logging: no origin configured is a deliberate "Postgres only" posture.
  if (!url) return undefined;
  const remembered = artifactMemo.get(objectPath);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAtMs = Date.now();
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      // `no-store`, deliberately: the cross-request cache for these bodies is the caller's
      // release-scoped memory (apps/web) or this module's memo, never Next's data cache, which
      // cannot hold them. Passing `force-cache` only produced a per-fetch "over 2MB" warning.
      cache: 'no-store',
      headers: artifactRequestHeaders(remembered),
    });
    if (response.status === 304) {
      if (remembered) return remembered.value as T;
      warnArtifactMiss(objectPath, 'http 304 with nothing remembered');
      return undefined;
    }
    if (!response.ok) {
      warnArtifactMiss(objectPath, `http ${response.status}`);
      return undefined;
    }
    const parsed = (await response.json()) as T;
    const etag = response.headers.get('etag');
    if (etag) rememberArtifact(objectPath, { etag, value: parsed });
    // Logged only on a real download, not on a 304: the Vercel log line is the signal that says
    // whether artifacts are still being re-downloaded, and its `encoding` field is the check
    // that compression is being negotiated.
    console.info(`[public-data] release artifact downloaded in ${Date.now() - startedAtMs}ms`, {
      objectPath,
      encoding: response.headers.get('content-encoding') ?? 'identity',
      revalidated: remembered !== undefined,
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

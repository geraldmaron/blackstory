/**
 * Upload + retry + partial-publish bookkeeping for publish-release-catalog-artifacts.ts.
 *
 * Extracted for the same reason release-catalog-publish-decision.ts's watermark logic is
 * extracted: the actual bug happened in production (2026-09-12, repo-kywgj). Two of three
 * consecutive runs died with a bare `fetch failed` mid-upload. On the first failure,
 * entities.json had already uploaded and search-index.json had not, leaving the published
 * pair mismatched — and the error gave no status, URL, or artifact name, so it was unclear
 * which upload had died. Testing the fix (retry, per-artifact hash bookkeeping, and a real
 * error message) needs a stubbed uploader, not a live database or Storage bucket.
 */

import { shouldUploadArtifact } from './release-catalog-publish-decision.ts';

export type RetryOptions = {
  readonly maxAttempts?: number;
  /** Base backoff in ms; actual delay is `baseDelayMs * 2^(attempt-1)`. */
  readonly baseDelayMs?: number;
  /** Injectable for deterministic tests; defaults to a real setTimeout-based sleep. */
  readonly sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `run` with exponential backoff (same shape as
 * `embeddings/provider.ts`'s `createRetryingEmbeddingProvider`). Re-throws the last error
 * once `maxAttempts` is exhausted — a caller that needs to know an upload never succeeded
 * (so it must not persist a hash or advance the watermark) sees a rejected promise, not a
 * swallowed failure.
 */
export async function retryWithBackoff<T>(
  run: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

/**
 * Thrown by `uploadArtifactJson` instead of letting a bare `fetch` rejection (or an HTTP
 * error response) escape unlabeled. `fetch`'s own failure message for a transient network
 * error is the literal string "fetch failed" with no status, no URL, and no indication of
 * which artifact was being uploaded — that is what made the live 2026-09-12 incident hard
 * to read.
 */
export class ArtifactUploadError extends Error {
  constructor(
    message: string,
    readonly details: {
      readonly objectPath: string;
      readonly url: string;
      readonly status?: number;
    },
    options?: { readonly cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ArtifactUploadError';
  }
}

export type UploadArtifactConfig = {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly bucket: string;
  readonly cacheControl: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
};

/**
 * Upserts one JSON artifact to Supabase Storage's REST API. Always throws
 * `ArtifactUploadError` on failure — never a bare `fetch` rejection — carrying the object
 * path, the full request URL, and the HTTP status when one was received.
 */
export async function uploadArtifactJson(
  objectPath: string,
  body: string,
  config: UploadArtifactConfig,
): Promise<void> {
  const base = config.supabaseUrl.replace(/\/+$/, '');
  const url = `${base}/storage/v1/object/${config.bucket}/${objectPath}`;
  const fetchImpl = config.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.secretKey}`,
        apikey: config.secretKey,
        'content-type': 'application/json; charset=utf-8',
        'cache-control': config.cacheControl,
        'x-upsert': 'true',
      },
      body,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new ArtifactUploadError(
      `upload failed for ${objectPath} at ${url}: ${cause}`,
      { objectPath, url },
      { cause: error },
    );
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ArtifactUploadError(
      `upload failed (${response.status}) for ${objectPath} at ${url}: ${detail.slice(0, 300)}`,
      { objectPath, url, status: response.status },
    );
  }
}

export type ArtifactPublishInput = {
  readonly objectPath: string;
  readonly body: string;
  readonly newHash: string;
  readonly previousHash: string | null;
  readonly force: boolean;
};

export type ArtifactPublishDependencies = {
  readonly upload: (objectPath: string, body: string) => Promise<void>;
  /** Persists JUST this artifact's published-hash column. Called only after `upload`
   * (with its retries) has actually succeeded. */
  readonly persistHash: (hash: string) => Promise<void>;
  readonly retry?: RetryOptions;
};

export type ArtifactPublishResult = { readonly uploaded: boolean };

/**
 * Publishes one artifact: skip if its content hash is unchanged (unless `force`), else
 * upload it (retried with backoff) and, ONLY once that upload has actually succeeded,
 * persist its own published-hash column immediately.
 *
 * This is deliberately NOT batched with the other artifact or with advancing
 * `published_at` — that batching is exactly what turned a single transient upload failure
 * into a silently mismatched published pair in the live incident this fixes. Call this once
 * per artifact and only advance `published_at` after BOTH calls have resolved: if this
 * rejects (retries exhausted), `persistHash` was never called for this artifact, so the
 * watermark still accurately reflects "not yet current" — the next run's `shouldUploadArtifact`
 * will retry only the artifact that actually failed, not redo the one that already succeeded.
 */
export async function publishArtifactWithRetry(
  input: ArtifactPublishInput,
  deps: ArtifactPublishDependencies,
): Promise<ArtifactPublishResult> {
  if (
    !shouldUploadArtifact({
      force: input.force,
      newHash: input.newHash,
      previousHash: input.previousHash,
    })
  ) {
    return { uploaded: false };
  }
  await retryWithBackoff(() => deps.upload(input.objectPath, input.body), deps.retry);
  await deps.persistHash(input.newHash);
  return { uploaded: true };
}

/**
 * Supabase Storage capture sink: persists the sanitized snapshot text of a capture as a
 * content-addressed object (`captures/<sha256>.txt`) in a private Supabase Storage bucket,
 * via the Storage REST API (`POST /storage/v1/object/<bucket>/<path>`, Bearer secret key).
 *
 * Chosen over GCS deliberately: the evidence DB is already Supabase Postgres, so blobs and
 * rows share one platform and one credential path (SUPABASE_URL + SUPABASE_SECRET_KEY),
 * and nothing new lands in the legacy Firebase/GCP project. No supabase-js dependency —
 * the upload is a single authenticated HTTP call, and the transport is injected for tests.
 *
 * Idempotent by construction: the object key is the sha256 of the raw bytes, and an
 * "already exists" (409) response is treated as stored — same content, same object.
 */
import type { CaptureStorage } from './source-capture.js';

export type SupabaseStorageConfig = {
  /** Project base URL, e.g. https://<ref>.supabase.co (no trailing slash needed). */
  readonly url: string;
  /** Service-role / secret key. Never logged; only sent as the Authorization header. */
  readonly secretKey: string;
  /** Private bucket name holding capture snapshots. */
  readonly bucket: string;
  /** Injected transport for tests; defaults to global fetch. */
  readonly transport?: typeof fetch;
};

/** Read the sink config from env; null when not configured (caller falls back to metadata-only). */
export function supabaseStorageConfigFromEnv(
  env: Record<string, string | undefined>,
): Omit<SupabaseStorageConfig, 'transport'> | null {
  const url = env.SUPABASE_URL?.trim();
  const secretKey = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey, bucket: env.SUPABASE_CAPTURE_BUCKET?.trim() || 'raw-sources' };
}

export function createSupabaseStorage(config: SupabaseStorageConfig): CaptureStorage {
  const base = config.url.replace(/\/+$/, '');
  const transport = config.transport ?? fetch;
  return {
    kind: 'supabase-storage',
    async store({ url, sha256, contentType, byteLength, text }) {
      const path = `captures/${sha256}.txt`;
      const response = await transport(
        `${base}/storage/v1/object/${config.bucket}/${path}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.secretKey}`,
            'content-type': 'text/plain; charset=utf-8',
            'x-upsert': 'false',
          },
          body: text,
        },
      );
      // 409 Duplicate = the content-addressed object already exists; identical by definition.
      if (!response.ok && response.status !== 409) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `supabase storage upload failed (${response.status}) for ${path}: ${detail.slice(0, 200)}`,
        );
      }
      return {
        stored: 'supabase-storage',
        bucket: config.bucket,
        path,
        sourceUrl: url,
        sha256,
        contentType,
        byteLength,
        snapshotBytes: text.length,
        deduplicated: response.status === 409,
      };
    },
  };
}

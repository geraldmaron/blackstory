/** Private, content-addressed extracted-text storage. Raw-source and text hashes stay distinct. */
import { createHash } from 'node:crypto';
import type { CaptureStorage } from './source-capture.js';

export type SupabaseStorageConfig = {
  /** Project base URL, e.g. https://<ref>.supabase.co (no trailing slash needed). */
  readonly url: string;
  /** Service-role / secret key. Never logged; only sent as the Authorization header. */
  readonly secretKey: string;
  /** Private bucket name holding capture snapshots. */
  readonly bucket: string;
  /** Authorization revision isolates renewed retention from pending deletions. */
  readonly retentionRevision?: string;
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

/** True when Storage rejected the write because that content-addressed key is already there. */
async function isAlreadyExistsResponse(response: Response): Promise<boolean> {
  if (response.status === 409) return true;
  const detail = await response
    .clone()
    .text()
    .catch(() => '');
  if (!detail) return false;
  try {
    const body = JSON.parse(detail) as { code?: unknown; statusCode?: unknown };
    return body.code === 'KeyAlreadyExists' || String(body.statusCode) === '409';
  } catch {
    return /KeyAlreadyExists|already exists/i.test(detail);
  }
}

export function createSupabaseStorage(config: SupabaseStorageConfig): CaptureStorage {
  if (config.retentionRevision && !/^[a-f0-9]{64}$/.test(config.retentionRevision))
    throw new Error('Invalid retention revision');
  const base = config.url.replace(/\/+$/, '');
  const transport = config.transport ?? fetch;
  return {
    kind: 'supabase-storage',
    async store({ url, sha256, contentType, byteLength, text }) {
      const snapshotSha256 = createHash('sha256').update(text, 'utf8').digest('hex');
      const path = `captures/${config.retentionRevision ? `${config.retentionRevision}/` : ''}${snapshotSha256}.txt`;
      const response = await transport(`${base}/storage/v1/object/${config.bucket}/${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.secretKey}`,
          apikey: config.secretKey,
          'content-type': 'text/plain; charset=utf-8',
          'x-upsert': 'false',
        },
        body: text,
        signal: AbortSignal.timeout(30_000),
      });
      // Duplicate is success: same hash, same object. Storage may send HTTP 409,
      // or HTTP 400 with a JSON body `{ statusCode: "409", code: "KeyAlreadyExists" }`.
      const alreadyExists = response.status === 409 || (await isAlreadyExistsResponse(response));
      if (!response.ok && !alreadyExists) {
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
        snapshotBytes: Buffer.byteLength(text, 'utf8'),
        snapshotSha256,
        representation: 'extracted-text',
        deduplicated: alreadyExists,
      };
    },
  };
}

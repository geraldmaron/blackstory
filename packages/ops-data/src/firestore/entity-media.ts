/**
 * Public-media object path helpers for entity primary images.
 * Object keys live under `public/entities/{entityId}/…`. Bytes are dual-served:
 * GCS (`black-book-efaaf-public-media`) for Admin SDK uploads / rollback, and
 * Supabase Storage `public-media` for public HTTPS URLs (ADR-020 blob cutover).
 */
import { supabasePublicMediaUrl } from '@repo/domain';

/** GCS bucket used by Firebase Admin Storage uploads (rollback / dual-serve). */
export const DEFAULT_PUBLIC_MEDIA_BUCKET = 'black-book-efaaf-public-media';

/** Supabase Storage bucket id for public HTTPS delivery. */
export const SUPABASE_PUBLIC_MEDIA_BUCKET = 'public-media';

export type EntityPrimaryImageObjectRef = {
  readonly bucket: string;
  readonly objectPath: string;
  readonly publicUrl: string;
};

/**
 * Canonical object path for an entity primary image inside the public-media bucket.
 * Example: `public/entities/ent_seed_school_001/primary.png`
 */
export function entityPrimaryImageObjectPath(entityId: string, filename = 'primary.png'): string {
  const safeId = entityId.trim();
  if (!safeId) {
    throw new Error('entityId is required for entity primary image object path');
  }
  const safeName = filename.replace(/^\/+/, '');
  return `public/entities/${safeId}/${safeName}`;
}

/**
 * Build storage ref + public HTTPS URL for a promoted entity primary image.
 * `bucket` remains the GCS upload target; `publicUrl` points at Supabase Storage.
 */
export function entityPrimaryImageObjectRef(
  entityId: string,
  options: {
    readonly bucket?: string;
    readonly filename?: string;
  } = {},
): EntityPrimaryImageObjectRef {
  const bucket = options.bucket ?? DEFAULT_PUBLIC_MEDIA_BUCKET;
  const objectPath = entityPrimaryImageObjectPath(entityId, options.filename ?? 'primary.png');
  return {
    bucket,
    objectPath,
    publicUrl: supabasePublicMediaUrl(objectPath),
  };
}

/**
 * Public-media object path helpers for entity primary images.
 * Objects live under `gs://{bucket}/public/entities/{entityId}/…` and are
 * referenced from `PublicEntityProjectionDoc.primaryImage.objectPath` + `url`.
 */
export const DEFAULT_PUBLIC_MEDIA_BUCKET = 'black-book-efaaf-public-media';

export type EntityPrimaryImageObjectRef = {
  readonly bucket: string;
  readonly objectPath: string;
  readonly publicUrl: string;
};

/**
 * Canonical object path for an entity primary image inside the public-media bucket.
 * Example: `public/entities/ent_seed_school_001/primary.png`
 */
export function entityPrimaryImageObjectPath(
  entityId: string,
  filename = 'primary.png',
): string {
  const safeId = entityId.trim();
  if (!safeId) {
    throw new Error('entityId is required for primary image object path');
  }
  const safeName = filename.replace(/^\/+/, '');
  return `public/entities/${safeId}/${safeName}`;
}

/**
 * Build GCS object ref + HTTPS URL for a promoted entity primary image.
 * Direct `storage.googleapis.com` URLs only work when the object (or bucket) is
 * publicly readable; production may front this with CDN instead.
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
    publicUrl: `https://storage.googleapis.com/${bucket}/${objectPath}`,
  };
}

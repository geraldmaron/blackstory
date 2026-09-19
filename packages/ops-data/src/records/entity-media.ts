/** Object references for entity images in Supabase public-media storage. */
import { supabasePublicMediaUrl } from '@repo/domain';

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
 * The upload bucket and public URL refer to the same storage object.
 */
export function entityPrimaryImageObjectRef(
  entityId: string,
  options: {
    readonly filename?: string;
  } = {},
): EntityPrimaryImageObjectRef {
  const bucket = SUPABASE_PUBLIC_MEDIA_BUCKET;
  const objectPath = entityPrimaryImageObjectPath(entityId, options.filename ?? 'primary.png');
  return {
    bucket,
    objectPath,
    publicUrl: supabasePublicMediaUrl(objectPath),
  };
}

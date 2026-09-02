/**
 * Cache-Control for entity primary image uploads (repo-ov9x).
 *
 * repo-ov9x found that 240 of 242 objects in the Supabase `public-media` bucket were
 * uploaded with no explicit Cache-Control, so Supabase Storage's default `no-cache` is
 * echoed to the browser: a returning visitor re-fetches every image on every visit instead
 * of serving it from local disk, even though the Smart CDN edge itself answers cheaply.
 *
 * That report could not locate a direct Supabase Storage REST (`x-upsert`) POST for entity
 * primary images in this repo — the actual upload path for entity images is the Firebase
 * Admin SDK's `bucket.upload()` against GCS (`black-book-efaaf-public-media`), which is
 * separately dual-served to Supabase Storage. GCS's equivalent of the `cache-control` HTTP
 * header on an `x-upsert` POST is the `metadata.cacheControl` upload option — this constant
 * and helper are the GCS-path equivalent of `publish-release-catalog-artifacts.ts`'s
 * `PUBLIC_ARTIFACT_CACHE_CONTROL`, applied to `promote-entity-primary-image.ts` and
 * `promote-commons-auto-propose.ts`'s `bucket.upload()` calls.
 *
 * Kept short (unlike the catalog artifact's long s-maxage): unlike the 16MB catalog JSON,
 * entity photos are small, individually addressed by objectPath, and the repo-ov9x report
 * only asked for a browser Cache-Control, not an edge TTL tuning pass.
 */
export const ENTITY_PRIMARY_IMAGE_CACHE_CONTROL = 'public, max-age=3600';

/** Build the GCS `bucket.upload()` metadata object for an entity primary image. */
export function entityPrimaryImageUploadMetadata(input: {
  readonly contentType: string;
  readonly custom: Readonly<Record<string, string>>;
}): {
  readonly contentType: string;
  readonly cacheControl: string;
  readonly metadata: Readonly<Record<string, string>>;
} {
  return {
    contentType: input.contentType,
    cacheControl: ENTITY_PRIMARY_IMAGE_CACHE_CONTROL,
    metadata: input.custom,
  };
}

/**
 * Supabase Storage public object URL helpers (ADR-020 blob cutover).
 * Builds HTTPS URLs for the `public-media` bucket; keeps GCS URL shape available
 * for dual-serve / rollback.
 */

const DEFAULT_SUPABASE_PROJECT_URL = 'https://twykhihqkcldpreuovay.supabase.co';
const DEFAULT_PUBLIC_MEDIA_BUCKET = 'public-media';
const DEFAULT_GCS_PUBLIC_MEDIA_BUCKET = 'black-book-efaaf-public-media';

export type PublicMediaUrlOptions = {
  readonly supabaseProjectUrl?: string;
  readonly supabaseBucket?: string;
  readonly gcsBucket?: string;
};

/**
 * Public HTTPS URL for an object in the Supabase `public-media` bucket.
 * `objectPath` is the key inside the bucket (e.g. `public/entities/ent_x/primary.jpg`).
 */
export function supabasePublicMediaUrl(
  objectPath: string,
  options: PublicMediaUrlOptions = {},
): string {
  const base = (options.supabaseProjectUrl ?? DEFAULT_SUPABASE_PROJECT_URL).replace(/\/$/, '');
  const bucket = options.supabaseBucket ?? DEFAULT_PUBLIC_MEDIA_BUCKET;
  const key = objectPath.replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/${bucket}/${key}`;
}

/**
 * Legacy GCS HTTPS URL for the same object path (dual-serve / rollback).
 */
export function gcsPublicMediaUrl(
  objectPath: string,
  options: PublicMediaUrlOptions = {},
): string {
  const bucket = options.gcsBucket ?? DEFAULT_GCS_PUBLIC_MEDIA_BUCKET;
  const key = objectPath.replace(/^\/+/, '');
  return `https://storage.googleapis.com/${bucket}/${key}`;
}

/**
 * Prefer Supabase when `preferSupabase` is true (default once cutover env is on);
 * otherwise return the GCS URL.
 */
export function resolvePublicMediaUrl(
  objectPath: string,
  options: PublicMediaUrlOptions & { readonly preferSupabase?: boolean } = {},
): string {
  if (options.preferSupabase === false) {
    return gcsPublicMediaUrl(objectPath, options);
  }
  return supabasePublicMediaUrl(objectPath, options);
}

export const PUBLIC_MEDIA_DEFAULTS = {
  supabaseProjectUrl: DEFAULT_SUPABASE_PROJECT_URL,
  supabaseBucket: DEFAULT_PUBLIC_MEDIA_BUCKET,
  gcsBucket: DEFAULT_GCS_PUBLIC_MEDIA_BUCKET,
} as const;

import { commonsUploadThumbnailUrl } from '@repo/domain/adapters/wikimedia/commons-media';

/**
 * A pinned Commons file is stored as a `Special:FilePath/<title>?width=960` URL (the mast
 * size); a pin card wants a narrower render, so rewrite the width there. An original
 * `upload.wikimedia.org` file goes through the /thumb/ rewrite; anything else passes through.
 */
export function pinThumbnailUrl(url: string, width: number): string {
  if (url.includes('/Special:FilePath/')) {
    return url.replace(/([?&])width=\d+/, `$1width=${width}`);
  }
  return commonsUploadThumbnailUrl(url, width);
}

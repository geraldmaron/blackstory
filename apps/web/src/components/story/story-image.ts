/**
 * Display sizes for story images. Story images are stored as original Commons files (often 2,000px
 * and up), so an index thumbnail or a cover would otherwise ship the full scan, and Commons
 * rate-limits hotlinked originals far sooner than its thumbnails.
 */
import { pinThumbnailUrl } from '../../lib/map-experience/entity-photo-index';

/**
 * The widths Commons renders thumbnails at. Any other width answers 400 (checked 2026-11-12:
 * 128 and 2304 fail, 120 and 1920 succeed), so a request snaps up to the next step.
 */
const COMMONS_STEPS = [120, 250, 330, 500, 960, 1280, 1920] as const;

/** With no stored width, only a step every Commons original is assumed to clear. */
const UNKNOWN_WIDTH_CEILING = 500;

/**
 * The URL to render an image at `width` CSS pixels (doubled for dense screens). Commons will not
 * upscale, so a resized URL is asked for only when the stored width says the original is wider.
 * A request past the largest step takes the largest step: an edge-to-edge cover asked for the
 * original used to ship a 7,000px scan that never finished painting. StoryImage falls back to the
 * original URL if the resized one fails anyway.
 */
export function storyImageSrc(url: string, width: number, storedWidth?: number): string {
  const step = COMMONS_STEPS.find((candidate) => candidate >= width * 2) ?? COMMONS_STEPS.at(-1)!;
  if (storedWidth !== undefined ? step >= storedWidth : step > UNKNOWN_WIDTH_CEILING) return url;
  return pinThumbnailUrl(url, step);
}

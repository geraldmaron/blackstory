import type { PublicEntityPrimaryImageView } from '../../data/public-seed';

/**
 * True when an image's own description says it is a drawing or rendering, not a photograph (the
 * African Burial Ground record's image is the memorial architect's "artist's impression"). Such an
 * image is never shown as a plate and never says it is a photograph.
 */
export function isRenderedImage(image: Pick<PublicEntityPrimaryImageView, 'alt'>): boolean {
  return /\bartist['’]?s (impression|rendering|conception)\b|\brendering\b/i.test(image.alt);
}

/** Public presentation only: a copied tile is not proof its source image is still unchanged. */
import type { AtmosphereTileCredit } from '../../../components/atmosphere/tile-credits';
import type { PublicEntityView } from '../../../data/public-seed';
import { sanitizePublicProseText } from '@repo/domain/editorial';

export const MOSAIC_CREDITS_PAGE_SIZE = 24;

export function mosaicCreditsPage(raw: string | readonly string[] | undefined, total: number) {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  const pageCount = Math.max(1, Math.ceil(total / MOSAIC_CREDITS_PAGE_SIZE));
  const page = Number.isSafeInteger(value) && value > 1 ? Math.min(value, pageCount) : 1;
  return { page, pageCount, start: (page - 1) * MOSAIC_CREDITS_PAGE_SIZE };
}

export function mosaicCreditsHref(page: number): string {
  return page > 1 ? `/stories/mosaic-credits?page=${page}` : '/stories/mosaic-credits';
}

export function mosaicCreditRow(
  tile: AtmosphereTileCredit,
  record: Pick<PublicEntityView, 'displayName'> | undefined,
) {
  const name = record ? sanitizePublicProseText(record.displayName).trim() : '';
  let recordedImageHref: string | undefined;
  try {
    const url = new URL(tile.sourceUrl);
    if (url.protocol === 'https:' || url.protocol === 'http:') recordedImageHref = url.toString();
  } catch {
    /* An invalid asset reference is not a public link. */
  }
  return {
    index: tile.index,
    tilePath: tile.path,
    name: name || undefined,
    recordHref: name ? `/entity/${encodeURIComponent(tile.entityId)}` : undefined,
    recordedImageHref,
  };
}

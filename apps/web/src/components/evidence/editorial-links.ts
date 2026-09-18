/**
 * Shareable editorial off-ramps from record evidence chrome into Methodology and Data.
 * Methodology anchors re-export the binding hrefs from `methodology-copy.ts`; decade links
 * use the Lives evidence appendix on `/lives/explorer`.
 */
import { isLivesDecade, LIVES_NATIONAL } from '@repo/domain/statistics/lives';
import { METHODOLOGY_SOURCE_LIBRARY_HREF } from '../../app/methodology/methodology-copy';
import type { EntityEraInput } from '../../lib/map-experience/entity-era-facts';
import { resolveEntityEraBuckets } from '../../lib/map-experience/entity-era-facts';
import { DEFAULT_LIVES_VIEW, buildLivesHref } from '../../lib/lives/lives-url-state';

export const METHODOLOGY_HOW_RECORD_GETS_IN_HREF = '/methodology#how-a-record-gets-in';
export const METHODOLOGY_EVIDENCE_GRADES_HREF = '/methodology#evidence-grades';
export const METHODOLOGY_HOW_IT_HOLDS_TOGETHER_HREF = '/methodology#how-it-holds-together';
export const METHODOLOGY_INTERNET_ARCHIVE_HREF = '/methodology#internet-archive';
export { METHODOLOGY_SOURCE_LIBRARY_HREF };

/** Map one decade bucket (e.g. `1930s`) to the Lives appendix when that decade exists. */
export function livedDecadeHrefForBucket(bucket: string): string | undefined {
  const decadeMatch = /^(\d{4})s$/i.exec(bucket.trim());
  if (!decadeMatch) return undefined;
  const decade = Number.parseInt(decadeMatch[1]!, 10);
  if (!isLivesDecade(decade)) return undefined;
  return buildLivesHref(LIVES_NATIONAL.slug, { ...DEFAULT_LIVES_VIEW, decade });
}

/** Prefer the earliest resolved bucket that opens a Lived decade view. */
export function livedDecadeHrefForEra(input: EntityEraInput): string | undefined {
  for (const bucket of resolveEntityEraBuckets(input)) {
    const href = livedDecadeHrefForBucket(bucket);
    if (href !== undefined) return href;
  }
  return undefined;
}

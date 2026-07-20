/**
 * Catalog-grounded search recommendations: suggest real index records for typeahead and
 * empty/zero-result states. Uses the same tiered text match as `rankRecords`, capped for UI.
 */
import { normalizeQuery, rankRecords } from './ranking.js';
import type { PublicSearchIndexDoc, SearchMatchField } from './types.js';

export type SearchRecommendation = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly matchedOn: SearchMatchField;
  readonly matchedText: string;
  readonly jurisdictionState?: string;
};

export type BuildSearchRecommendationsInput = {
  readonly query: string;
  readonly index: readonly PublicSearchIndexDoc[];
  /** Max suggestions to return (default 8). */
  readonly limit?: number;
  /**
   * When true (default), an empty query returns connection-ranked browse suggestions so the
   * empty search surface can show "from the archive" picks.
   */
  readonly allowBrowse?: boolean;
};

/**
 * Builds recommendation rows from the published search index. Empty query → browse by
 * connection strength (unless `allowBrowse` is false). Non-empty query → text-ranked matches.
 */
export function buildSearchRecommendations(
  input: BuildSearchRecommendationsInput,
): readonly SearchRecommendation[] {
  const limit = input.limit ?? 8;
  const normalized = normalizeQuery(input.query);
  if (!normalized && input.allowBrowse === false) return [];

  const ranked = rankRecords(normalized, input.index);
  return ranked.slice(0, limit).map((entry) => ({
    id: entry.record.id,
    kind: entry.record.kind,
    displayName: entry.record.displayName,
    ...(entry.record.summary !== undefined ? { summary: entry.record.summary } : {}),
    matchedOn: entry.matchedOn,
    matchedText: entry.matchedText,
    ...(entry.record.jurisdictionState !== undefined
      ? { jurisdictionState: entry.record.jurisdictionState }
      : {}),
  }));
}

/**
 * Shared text ranking helpers for typeahead suggestions (exact → prefix → substring).
 */
export function normalizeTypeaheadQuery(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type TypeaheadTier = {
  readonly tier: number;
  readonly haystack: string;
};

/**
 * True when every token of a multi-word query appears somewhere in `haystack`. Conjunctive, so
 * "calvin shirley" needs both words and does not match every record mentioning a Calvin.
 */
function matchesAllTokens(query: string, haystack: string): boolean {
  const queryTokens = query.split(' ').filter((token) => token.length > 0);
  if (queryTokens.length < 2) return false;
  return queryTokens.every((token) => haystack.includes(token));
}

/**
 * Returns match tier or 0 when no match.
 *
 * The token tier sits below a contiguous substring and above no-match. Without it, every matcher
 * built on this helper (the Atlas palette, the books typeahead) failed on a first-name/last-name
 * query against any record carrying a title or a middle initial: "calvin shirley" is not a
 * substring of "Dr. Calvin H. Shirley", so the palette answered "Nothing matches that" for a
 * record it holds. Mirrors `TIER_NAME_TOKENS` in @repo/domain's search ranking, so the palette
 * and /search/api agree about what a two-word name query means.
 */
export function typeaheadMatchTier(query: string, haystack: string): number {
  const q = normalizeTypeaheadQuery(query);
  const name = normalizeTypeaheadQuery(haystack);
  if (!q || q.length < 2 || !name) return 0;
  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q)) return 80;
  if (matchesAllTokens(q, name)) return 75;
  return 0;
}

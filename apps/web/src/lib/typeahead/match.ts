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

/** Returns match tier or 0 when no match. */
export function typeaheadMatchTier(query: string, haystack: string): number {
  const q = normalizeTypeaheadQuery(query);
  const name = normalizeTypeaheadQuery(haystack);
  if (!q || q.length < 2 || !name) return 0;
  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q)) return 80;
  return 0;
}

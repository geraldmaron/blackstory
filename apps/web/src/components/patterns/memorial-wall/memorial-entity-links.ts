/**
 * Exact-match memorial name -> public entity id. Only the small subset of
 * memorial names that also have a real, public entity page should link
 * through; everything else stays plain text. Matching is exact (case-
 * insensitive, trimmed, whitespace-normalized) against entity displayName —
 * no fuzzy matching, so we never link a name to the wrong record.
 */

export type MemorialEntityCandidate = {
  readonly id: string;
  readonly displayName: string;
};

function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Build a name -> entityId map for memorial names with an exact display-name
 * match in the public entity catalog. First entity wins on duplicate
 * displayName (should not occur in production data, but keeps this pure).
 */
export function matchMemorialNamesToEntities(
  names: readonly string[],
  entities: readonly MemorialEntityCandidate[],
): ReadonlyMap<string, string> {
  const byDisplayName = new Map<string, string>();
  for (const entity of entities) {
    const key = normalizeMatchKey(entity.displayName);
    if (key.length === 0 || byDisplayName.has(key)) {
      continue;
    }
    byDisplayName.set(key, entity.id);
  }

  const matches = new Map<string, string>();
  for (const name of names) {
    const id = byDisplayName.get(normalizeMatchKey(name));
    if (id) {
      matches.set(name, id);
    }
  }
  return matches;
}

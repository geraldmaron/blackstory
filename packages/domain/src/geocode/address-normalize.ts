/**
 * Address-text normalization. Purely textual
 * collapses whitespace, trims stray punctuation, and upper-cases a small set of common street
 * abbreviations so visually-equivalent inputs ("123 Main St." vs "123 main street") produce the
 * same Census Geocoder query and the same geocode-cache key. This is intentionally a different,
 * address-shaped normalizer from `@repo/security`'s `normalizeSearchText` (free-
 * text search normalizer) `@repo/domain` cannot depend on `@repo/security` at
 * runtime (see `./jurisdiction-ids.ts`'s module doc for the same circular-dependency rule), and
 * address normalization has different goals (preserve number/street-suffix structure for the
 * geocoder) than search-query normalization (fold for fuzzy matching).
 */

const STREET_SUFFIX_EXPANSIONS: Readonly<Record<string, string>> = {
  st: 'street',
  rd: 'road',
  ave: 'avenue',
  blvd: 'boulevard',
  ln: 'lane',
  dr: 'drive',
  ct: 'court',
  pl: 'place',
  ter: 'terrace',
  cir: 'circle',
  hwy: 'highway',
  pkwy: 'parkway',
  sq: 'square',
};

/** Collapses whitespace and strips characters the Census Geocoder does not need (quotes, `#` noise aside from unit markers). */
export function normalizeAddressText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/["“”]/g, '')
    .trim();
}

/**
 * Expands common street-suffix abbreviations for the OUTGOING Census query (the geocoder
 * tolerates both forms, but a single canonical form maximizes cache-hit consistency). Word
 * boundaries only never touches letters inside a longer word.
 */
export function expandCommonAbbreviations(text: string): string {
  return text.replace(/\b[A-Za-z]+\.?/g, (word) => {
    const key = word.toLowerCase().replace(/\.$/, '');
    const expansion = STREET_SUFFIX_EXPANSIONS[key];
    return expansion ?? word;
  });
}

export type NormalizedAddressInput = {
  /** Text to send to the Census Geocoder. */
  readonly queryText: string;
  /** Case-folded, whitespace-collapsed key for the geocode cache never logged verbatim. */
  readonly cacheKey: string;
};

/** Full normalization pipeline: collapse whitespace -> expand abbreviations -> build a cache key. */
export function normalizeAddressInput(raw: string): NormalizedAddressInput {
  const collapsed = normalizeAddressText(raw);
  const queryText = expandCommonAbbreviations(collapsed);
  return {
    queryText,
    cacheKey: `addr:${queryText.toUpperCase()}`,
  };
}

/** Cache key for a reverse-geocode (browser location) lookup, rounded to ~11m to bound cache cardinality. */
export function coordinateCacheKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 10_000) / 10_000;
  const roundedLng = Math.round(lng * 10_000) / 10_000;
  return `coord:${roundedLat.toFixed(4)},${roundedLng.toFixed(4)}`;
}

/** Cache key for a ZIP translate-then-discard lookup. The ZIP itself is not retained past this call. */
export function zipCacheKey(zip: string): string {
  return `zip:${zip.trim()}`;
}

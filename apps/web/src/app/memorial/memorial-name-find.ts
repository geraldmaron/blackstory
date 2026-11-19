/**
 * Matching for the memorial list's "Find a name" field. Kept apart from memorial-names.ts so the
 * client bundle carries these few lines and not the whole name archive.
 */

/**
 * Case, accents, punctuation and spaces folded away, so "jd may", "J.D. May" and "adonte" find
 * "J. D. Mayfield" and "A'donte Washington" however the list happens to write them.
 */
export function memorialFindKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** True when the folded query appears anywhere in the folded name. An empty query matches all. */
export function memorialNameMatches(name: string, query: string): boolean {
  return memorialFindKey(name).includes(memorialFindKey(query));
}

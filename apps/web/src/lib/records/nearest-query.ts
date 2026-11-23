/**
 * "Did you mean": the nearest spelling the archive actually holds for a search that matched
 * nothing. Built from the words already loaded for matching (each record's name, summary and
 * place), so it needs no index and no dependency, and it can only ever offer a word some record
 * contains. It is an offer the page prints, never a silent rewrite of what the reader typed.
 *
 * shortcut: whole-word edits only (one edit, two for words of eight letters or more), so a missing
 * space, a phonetic spelling ("fillidelfia") or a wrong word is not caught; upgrade to a trigram
 * index on `published.search_index` when the read test shows those misses matter.
 */

const WORD = /[a-z]{3,}/g;

/** Optimal string alignment distance: insertions, deletions, substitutions, adjacent swaps. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let least = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2]! + 1);
      }
      current.push(value);
      least = Math.min(least, value);
    }
    if (least > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * The query with each unknown word replaced by the nearest word the records hold, or null when
 * every word is already known, or any unknown word has no near neighbor (no guess is better than
 * half a guess). Among equally near words the one in the most records wins.
 */
export function nearestQuery(q: string, haystacks: readonly string[]): string | null {
  const words = q.toLowerCase().match(WORD) ?? [];
  if (words.length === 0) return null;
  const counts = new Map<string, number>();
  for (const haystack of haystacks) {
    for (const word of new Set(haystack.match(WORD) ?? [])) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  let changed = false;
  let out = q.toLowerCase();
  for (const word of words) {
    if (counts.has(word)) continue;
    const limit = word.length >= 8 ? 2 : 1;
    let best: { readonly word: string; readonly distance: number; readonly count: number } | null =
      null;
    for (const [candidate, count] of counts) {
      const distance = editDistance(word, candidate, limit);
      if (distance > limit) continue;
      if (
        best === null ||
        distance < best.distance ||
        (distance === best.distance && count > best.count)
      ) {
        best = { word: candidate, distance, count };
      }
    }
    if (best === null) return null;
    out = out.replace(word, best.word);
    changed = true;
  }
  return changed ? out : null;
}

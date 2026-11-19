/**
 * Search snippets for the Records register: the part of a summary that holds the reader's term,
 * split so the row can set the term in bold. Pure, so the server renders it and a test pins it.
 */

export type TextSegment = { readonly text: string; readonly match: boolean };

/** Splits `text` around every case-insensitive occurrence of `needle`. */
export function highlightSegments(text: string, needle: string): readonly TextSegment[] {
  const term = needle.trim().toLowerCase();
  if (term.length === 0) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const segments: TextSegment[] = [];
  let at = 0;
  for (let hit = lower.indexOf(term); hit !== -1; hit = lower.indexOf(term, at)) {
    if (hit > at) segments.push({ text: text.slice(at, hit), match: false });
    segments.push({ text: text.slice(hit, hit + term.length), match: true });
    at = hit + term.length;
  }
  if (at < text.length) segments.push({ text: text.slice(at), match: false });
  return segments;
}

/** Characters kept before the first hit, so the term lands early on a one-line clamp. */
const LEAD = 48;

/**
 * The window of `text` around the first hit, cut at word boundaries and marked with an ellipsis
 * where it was cut. `undefined` when the term is not in the text.
 */
export function matchSnippet(text: string, needle: string): readonly TextSegment[] | undefined {
  const term = needle.trim().toLowerCase();
  if (term.length === 0) return undefined;
  const hit = text.toLowerCase().indexOf(term);
  if (hit === -1) return undefined;
  let start = Math.max(0, hit - LEAD);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    start = space !== -1 && space < hit ? space + 1 : start;
  }
  const window = `${start > 0 ? '…' : ''}${text.slice(start)}`;
  return highlightSegments(window, term);
}

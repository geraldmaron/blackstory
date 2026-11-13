/**
 * Presentation splits of authored story text. Neither changes a word: each only decides where the
 * text breaks so it can be set at two sizes.
 */

/**
 * A chapter section heading often leads with its year: "1790 · A ledger open on his knee",
 * "Today · You are counted, still". The spine shows that year as data above the title. Headings
 * without one ("The record") come back whole, with no year.
 */
export function splitSectionHeading(text: string): {
  readonly year?: string;
  readonly title: string;
} {
  const match = /^(\d{3,4}s?|Today)\s*[·:–—-]\s*(.+)$/u.exec(text.trim());
  return match ? { year: match[1]!, title: match[2]! } : { title: text.trim() };
}

/** Above this many words a summary is too long to set whole at standfirst size. */
const LEDE_WORD_LIMIT = 60;

/**
 * Where the first sentence of `text` ends, or undefined when it cannot be found safely: an
 * abbreviation such as "U.S." is not a sentence end, and a fragment under 40 characters is not
 * taken as a sentence.
 */
function firstSentenceEnd(text: string): number | undefined {
  const sentenceEnd = /[.!?]["”’)]?\s+(?=["“‘(]?[A-Z])/g;
  for (const match of text.matchAll(sentenceEnd)) {
    const end = (match.index ?? 0) + match[0].trimEnd().length;
    const head = text.slice(0, end);
    if (/(?:^|[\s.])[A-Z]\.$/.test(head) || head.length < 40) continue;
    return end;
  }
  return undefined;
}

/**
 * A long summary splits after its first sentence: the first sentence is set large, the rest at
 * body size under it. A short summary, or one whose first sentence cannot be found safely, stays
 * whole.
 */
export function splitLede(summary: string): { readonly dek: string; readonly rest?: string } {
  const text = summary.trim();
  if (text.split(/\s+/).length <= LEDE_WORD_LIMIT) return { dek: text };
  const end = firstSentenceEnd(text);
  const rest = end === undefined ? '' : text.slice(end).trim();
  return rest.length > 0 ? { dek: text.slice(0, end), rest } : { dek: text };
}

/**
 * A cover dek: the summary's first sentence, set whole. A cover never cuts a sentence mid-phrase;
 * a summary with no safe sentence end comes back whole.
 */
export function coverDek(summary: string): string {
  const text = summary.trim();
  const end = firstSentenceEnd(text);
  return end === undefined ? text : text.slice(0, end);
}

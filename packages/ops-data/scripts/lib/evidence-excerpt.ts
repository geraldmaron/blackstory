/**
 * repo-z57b — relevance-aware excerpting for the evidence read window.
 *
 * The window used to be a head slice: the first `cap` characters of the document, and nothing
 * else. That works whenever the significance narrative happens to sit at the front, which after
 * repo-a3wx (significance ordered first) is most of the time. It fails on exactly the documents
 * where it costs the most — very large district nominations, where the captured section 8 opens
 * on criteria checkboxes, UTM points, boundary justification and pages of owner names, and the
 * Black-history narrative begins well past the cap.
 *
 * Measured on the three entities that ended wave 5 unfinished:
 *
 *   Big Sink Rural HD (93001523)   289,945 chars   first lane term at  13,532   dense from  79,550
 *   Charles Town, Old (00001308)   231,565 chars   dense from  13,676
 *   Redd Road Rural HD (91000153)   49,283 chars   dense from  12,183
 *
 * All three have `hasSignificance: true` and section 8 captured. Nothing was missing from the
 * capture; the head slice simply landed in front of the history. Raising the cap does not fix
 * this class — Big Sink's best passages are at 40% and 55% of a 290k document, and a cap large
 * enough to reach them by head slice would blow the prompt budget on building inventory.
 *
 * So instead of reading the front of the document, read the parts of it that are about the lane.
 * The excerpt is: a lead block (the statement-of-significance opening, which carries the criteria,
 * period and framing) plus the highest-scoring passages around lane-term matches, in document
 * order, elisions marked. Every character is still verbatim from the source, so the validator's
 * verbatim-quote rule is unaffected — a quote is checked against the text the drafter was handed.
 *
 * WHY SCORE RATHER THAN TAKE IN DOCUMENT ORDER.
 *
 * (Full note on how a passage is scored is on `scorePassage` below.) Taking matches in order fills the budget with the
 * first weak hit ("black walnut woodwork", "Black Heritage" on the Areas of Significance line) and
 * never reaches the narrative. Scoring by weighted term density puts the passage that discusses a
 * Black community ahead of the passage that mentions a colour.
 */

import { measureTextQuality, scoreTextQuality } from './evidence-collectors/text-quality.ts';

/**
 * Terms whose presence marks a passage as carrying the lane's subject matter, with a weight for
 * how strongly. Multi-word phrases score high because they are almost never incidental; the bare
 * colour words score low because a nomination form uses them for paint, walnut, and slate.
 *
 * "black" at weight 1 earns its place despite the noise: period nominations write "blacks in
 * Charles Town" and "the black community" far more often than they write "African American", and
 * dropping it loses the 1990s Kentucky documents entirely. The weighting, not the membership, is
 * what keeps a woodwork paragraph from outranking a settlement one.
 */
const LANE_TERM_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ['african american', 3],
  ['african-american', 3],
  ['afro-american', 3],
  ['african methodist', 3],
  ['colored methodist', 3],
  ['black heritage', 3],
  ['black community', 3],
  ['black church', 3],
  ['black school', 3],
  ['black population', 3],
  ['black residents', 3],
  ['black families', 3],
  ['black neighborhood', 3],
  ['free black', 3],
  ['underground railroad', 3],
  ['freedmen', 3],
  ['freedman', 3],
  ['freedwoman', 3],
  ['emancipation', 3],
  ['manumission', 3],
  ['jim crow', 3],
  ['civil rights', 3],
  ['rosenwald', 3],
  ['naacp', 3],
  ['race riot', 3],
  ['racial', 2],
  ['segregation', 3],
  ['segregated', 3],
  ['desegregation', 3],
  ['integration', 2],
  ['lynching', 3],
  ['redlining', 3],
  ['slave', 2],
  ['slaves', 2],
  ['slavery', 3],
  ['enslaved', 3],
  ['negro', 2],
  ['negroes', 2],
  ['colored', 2],
  ['coloured', 2],
  ['mulatto', 2],
  ['ethnic heritage', 2],
  ['black', 1],
  ['blacks', 1],
];

/** Compiled once. Word-boundary matched so "quarters" does not fire on "headquarters". */
const LANE_TERM_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly weight: number;
  readonly term: string;
}> = LANE_TERM_WEIGHTS.map(([term, weight]) => ({
  pattern: new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'giu'),
  weight,
  term,
}));

/** Exported for the audit scripts and tests that want the vocabulary without the excerpting. */
export const LANE_RELEVANCE_TERMS: readonly string[] = LANE_TERM_WEIGHTS.map(([term]) => term);

/** Marks a gap in an excerpt. Chosen to be visibly not-prose so a quote across it reads as wrong. */
export const ELISION_MARKER = '\n\n[…]\n\n';

/** Share of the window spent on the document's opening, which carries the criteria and framing. */
const LEAD_SHARE = 0.3;
const LEAD_MAX_CHARS = 3_000;

/** Context kept around a match. More after than before: the narrative follows the term. */
const CONTEXT_BEFORE_CHARS = 700;
const CONTEXT_AFTER_CHARS = 1_500;

/** Passages closer than this are merged rather than separated by a marker for a few characters. */
const MERGE_GAP_CHARS = 200;

/** A passage shorter than this is not worth a marker and the context to read it. */
const MIN_PASSAGE_CHARS = 400;

/** How far a boundary may move to land on whitespace instead of mid-word. */
const SNAP_WINDOW_CHARS = 80;

export type EvidenceExcerpt = {
  /** What the drafter reads. Verbatim from the source except at ELISION_MARKER. */
  readonly text: string;
  /** True when the source was short enough to hand over whole. */
  readonly complete: boolean;
  /** Weighted lane-term hits across the WHOLE document, not just the excerpt. */
  readonly laneTermScore: number;
  /** Source characters not included. 0 when complete. */
  readonly omittedChars: number;
};

type Span = {
  start: number;
  end: number;
  /** term -> weight, deduplicated: a passage is scored on variety, not repetition. */
  terms: Map<string, number>;
  hits: number;
  score: number;
};

/** Above this share of repeated shingles, a candidate passage is a restatement of a chosen one. */
const DUPLICATE_SHINGLE_SHARE = 0.5;

const SHINGLE_CHARS = 60;
const SHINGLE_STRIDE_CHARS = 200;

/**
 * Sampled fixed-length slices of normalized text, used only to recognize a passage we already
 * took. Sampling by stride rather than fingerprinting the head means two copies still match when
 * the passage boundaries land at different offsets in each copy.
 */
function shinglesOf(text: string): readonly string[] {
  const normalized = text.toLowerCase().replace(/\s+/gu, ' ');
  const shingles: string[] = [];
  for (let at = 0; at + SHINGLE_CHARS <= normalized.length; at += SHINGLE_STRIDE_CHARS) {
    shingles.push(normalized.slice(at, at + SHINGLE_CHARS));
  }
  return shingles;
}

/** Move `index` to the nearest whitespace boundary so an excerpt never opens or closes mid-word. */
function snap(text: string, index: number, direction: -1 | 1): number {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  for (let offset = 0; offset <= SNAP_WINDOW_CHARS; offset += 1) {
    const at = index + offset * direction;
    if (at <= 0 || at >= text.length) break;
    if (/\s/u.test(text[at] ?? '')) return at;
  }
  return index;
}

function laneTermMatches(
  text: string,
): ReadonlyArray<{ index: number; weight: number; term: string }> {
  const matches: { index: number; weight: number; term: string }[] = [];
  for (const { pattern, weight, term } of LANE_TERM_PATTERNS) {
    pattern.lastIndex = 0;
    let hit = pattern.exec(text);
    while (hit !== null) {
      matches.push({ index: hit.index, weight, term });
      hit = pattern.exec(text);
    }
  }
  return matches;
}

/**
 * How much a passage is worth reading, from two signals that pull in different directions from
 * raw occurrence count.
 *
 * DISTINCT terms, not total hits. Big Sink's photo log repeats "slave quarter" down forty caption
 * lines and outscored the district's actual settlement history on occurrence count. A passage
 * that reaches for several different terms — African American, freedmen, emancipation,
 * segregation — is discussing a subject; a passage that says one term forty times is an index.
 *
 * Times prose quality, reusing WS3's OCR scorer (text-quality.ts) rather than a second opinion
 * about what damaged text looks like. That same photo log is half OCR wreckage, and a caption
 * list is not something a drafter can write history from even when the captions are legible.
 */
function scorePassage(text: string, terms: ReadonlyMap<string, number>, hits: number): number {
  let termScore = 0;
  for (const weight of terms.values()) termScore += weight;
  // A little credit for density, capped, so it breaks ties without restoring the repetition bug.
  const densityBonus = Math.min(hits, 5) * 0.1;
  return (termScore + densityBonus) * scoreTextQuality(measureTextQuality(text));
}

/**
 * Selects up to `cap` characters of `text`, preferring the passages that carry the lane's subject
 * matter over the ones that happen to come first.
 *
 * Falls back to the plain head slice when the document contains no lane terms past the lead —
 * there is nothing to prefer, and a head slice is at least the document's own opening argument.
 * `laneTermScore === 0` on the result is the signal that the document says nothing about the lane
 * anywhere, which is a fact worth telling a drafter rather than leaving it to infer.
 */
export function excerptForWindow(text: string, cap: number): EvidenceExcerpt {
  const allMatches = laneTermMatches(text);
  const laneTermScore = allMatches.reduce((sum, match) => sum + match.weight, 0);

  if (text.length <= cap) {
    return { text, complete: true, laneTermScore, omittedChars: 0 };
  }

  const leadEnd = snap(text, Math.min(LEAD_MAX_CHARS, Math.floor(cap * LEAD_SHARE)), 1);
  const lead = text.slice(0, leadEnd);

  const tailMatches = allMatches.filter((match) => match.index >= leadEnd);
  if (tailMatches.length === 0) {
    const head = text.slice(0, cap);
    return { text: head, complete: false, laneTermScore, omittedChars: text.length - head.length };
  }

  // One span per match, then merge the overlaps so a dense run becomes a single readable passage
  // rather than a dozen restatements of the same paragraph.
  const spans: Span[] = tailMatches
    .map((match) => ({
      start: Math.max(leadEnd, match.index - CONTEXT_BEFORE_CHARS),
      end: Math.min(text.length, match.index + CONTEXT_AFTER_CHARS),
      terms: new Map([[match.term, match.weight]]),
      hits: 1,
      score: 0,
    }))
    .sort((a, b) => a.start - b.start);

  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span.start - last.end <= MERGE_GAP_CHARS) {
      last.end = Math.max(last.end, span.end);
      last.hits += span.hits;
      for (const [term, weight] of span.terms) last.terms.set(term, weight);
      continue;
    }
    merged.push(span);
  }
  for (const span of merged) {
    span.score = scorePassage(text.slice(span.start, span.end), span.terms, span.hits);
  }

  // Highest-scoring first, so the budget buys narrative rather than whichever colour word the
  // building inventory used earliest, or whichever caption list repeats a term the most.
  const byScore = [...merged].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.start - b.start;
  });

  const chosen: Span[] = [];
  const seenShingles = new Set<string>();
  let budget = cap - lead.length - ELISION_MARKER.length;
  for (const span of byScore) {
    if (budget < MIN_PASSAGE_CHARS) break;
    const length = span.end - span.start;
    const take = Math.min(length, budget);
    if (take < MIN_PASSAGE_CHARS) continue;
    const body = text.slice(span.start, span.start + take);
    // Nomination forms for multiple-property listings restate whole sections, so the two
    // highest-scoring passages are routinely the same prose at two offsets. Measured on Big Sink,
    // where an identical "Ethnic History" paragraph took two of four passage slots.
    const shingles = shinglesOf(body);
    const repeats = shingles.filter((shingle) => seenShingles.has(shingle)).length;
    if (shingles.length > 0 && repeats / shingles.length > DUPLICATE_SHINGLE_SHARE) continue;
    for (const shingle of shingles) seenShingles.add(shingle);
    chosen.push({ ...span, end: span.start + take });
    budget -= take + ELISION_MARKER.length;
  }
  if (chosen.length === 0) {
    const head = text.slice(0, cap);
    return { text: head, complete: false, laneTermScore, omittedChars: text.length - head.length };
  }

  chosen.sort((a, b) => a.start - b.start);
  const pieces: string[] = [lead];
  let includedChars = lead.length;
  let previousEnd = leadEnd;
  for (const span of chosen) {
    const start = snap(text, span.start, -1);
    const end = snap(text, span.end, 1);
    // A merge pass ran over the pre-snap spans, but snapping can still make two neighbours touch.
    if (start <= previousEnd) {
      if (end <= previousEnd) continue;
      const continuation = text.slice(previousEnd, end);
      pieces[pieces.length - 1] += continuation;
      includedChars += continuation.length;
      previousEnd = end;
      continue;
    }
    pieces.push(text.slice(start, end));
    includedChars += end - start;
    previousEnd = end;
  }

  // Snapping to word boundaries moves each edge by up to SNAP_WINDOW_CHARS, which can carry the
  // join a little past the budget the spans were chosen against. The cap is a hard promise to the
  // prompt-size arithmetic in entity-enrichment-fetch.ts, so it is enforced here rather than
  // assumed — at a small cap the snap overhang is a measurable share of the window.
  let joined = pieces.join(ELISION_MARKER);
  if (joined.length > cap) {
    const trimmed = joined.slice(0, cap);
    const lastSpace = trimmed.lastIndexOf(' ');
    joined = lastSpace > cap - SNAP_WINDOW_CHARS ? trimmed.slice(0, lastSpace) : trimmed;
    includedChars = Math.min(includedChars, joined.length);
  }

  return {
    text: joined,
    complete: false,
    laneTermScore,
    omittedChars: text.length - includedChars,
  };
}

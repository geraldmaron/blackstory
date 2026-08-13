/**
 * repo-8zvt — read a National Register nomination's PERIOD OF SIGNIFICANCE.
 *
 * NRHP records are the catalog's largest population and its least dated: their only date is the
 * day the property was listed, which is a fact about paperwork, not about history. The nomination
 * form carries the real answer in a field the roster spreadsheet does not export.
 *
 * Three readings, most authoritative first, and the winner is reported so a reviewer can tell
 * which one produced a given era:
 *
 *   'field'        NPS Form 10-900 item 9, "Period of Significance 1929-1950". A transcribed form
 *                  field — the registered answer, and the one to trust.
 *   'justification' the Section 8 continuation prose, "the period of significance is the years
 *                  1910-1955" or "begins in 1906". Present when the form field OCR'd badly.
 *   'construction'  "built in 1888" / "constructed c. 1902". A single year, and a weaker claim:
 *                  it dates the fabric, not the significance. Kept because 1,121 of 1,227
 *                  captured nominations carry it while only 553 state a period outright.
 *
 * THE LISTING DATE MUST NEVER BE READ AS ERA. That confusion is the whole reason this exists, so
 * matching is confined to a window after a period-of-significance cue rather than run over the
 * document, and any year inside a full calendar date ("April 12, 2001") is discarded — listing
 * dates are written that way on the form and periods of significance never are.
 */

/** Years a nomination can plausibly assert. NRHP covers pre-contact through the recent past. */
const MIN_YEAR = 1500;

export type PeriodMethod = 'field' | 'justification' | 'construction';

export type PeriodOfSignificance = {
  /** Inclusive start year. */
  readonly startYear: number;
  /** Inclusive end year; equals startYear for a single dated year. */
  readonly endYear: number;
  readonly method: PeriodMethod;
  /** The text the years were read out of, for audit. */
  readonly evidence: string;
};

/** A full calendar date — how listing dates are written, and how periods never are. */
const CALENDAR_DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*(\d{4})\b/gi;

const YEAR = /\b(1[5-9]\d{2}|20[0-2]\d)\b/g;
/** "1929-1950", "1910–1955", "1929 to 1950". */
const RANGE = /\b(1[5-9]\d{2}|20[0-2]\d)\s*(?:-|–|—|\bto\b)\s*(1[5-9]\d{2}|20[0-2]\d)\b/;

// The lookahead must sit before the whitespace is consumed: with `\s*` first, backtracking
// lets the engine match zero spaces and the lookahead then sees " (justification", which does
// not start with "(", so the exclusion silently never fires.
const FIELD_CUE = /period\s+of\s+significance\b(?!\s*\(justification)\s*:?\s*/i;
const JUSTIFICATION_CUE = /period\s+of\s+significance\b[^.]{0,40}?(?:begins?|is|spans?|covers?|runs?|extends?)\b/i;
const CONSTRUCTION_CUE = /\b(?:built|constructed|erected|completed|established|founded)\b(?:\s+\w+){0,3}?\s+(?:in\s+|c\.?\s*|ca\.?\s*|circa\s+)?(1[5-9]\d{2}|20[0-2]\d)\b/i;

/** Years that belong to a full calendar date, which is the listing-date shape. */
function calendarDateYears(text: string): ReadonlySet<string> {
  const years = new Set<string>();
  for (const match of text.matchAll(CALENDAR_DATE)) {
    if (match[1]) years.add(match[1]);
  }
  return years;
}

function plausible(start: number, end: number, maxYear: number): boolean {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start < MIN_YEAR || end > maxYear) return false;
  if (end < start) return false;
  // A period of significance is a historical span, not an epoch. The widest real ones run a
  // couple of centuries; anything beyond that is two unrelated years swept up by one window.
  return end - start <= 200;
}

function readWindow(
  text: string,
  cue: RegExp,
  method: PeriodMethod,
  maxYear: number,
  windowChars: number,
): PeriodOfSignificance | undefined {
  const cueMatch = cue.exec(text);
  if (!cueMatch) return undefined;
  const from = cueMatch.index + cueMatch[0].length;
  const window = text.slice(from, from + windowChars);
  const excluded = calendarDateYears(window);

  const range = RANGE.exec(window);
  if (range?.[1] && range[2] && !excluded.has(range[1]) && !excluded.has(range[2])) {
    const start = Number.parseInt(range[1], 10);
    const end = Number.parseInt(range[2], 10);
    if (plausible(start, end, maxYear)) {
      return { startYear: start, endYear: end, method, evidence: range[0] };
    }
    // A range WAS stated and it is not credible — OCR damage, or two unrelated years pulled
    // together. Its first year is not a safer answer than no answer, so stop here rather than
    // falling through and publishing half of a reading we just rejected.
    return undefined;
  }

  for (const match of window.matchAll(YEAR)) {
    const raw = match[0];
    if (excluded.has(raw)) continue;
    const year = Number.parseInt(raw, 10);
    if (plausible(year, year, maxYear)) {
      return { startYear: year, endYear: year, method, evidence: raw };
    }
  }
  return undefined;
}

/**
 * Read the period of significance from nomination text, or `undefined` when it states none.
 *
 * `undefined` is a real answer and must stay available: a nomination that never states a period
 * leaves the record undated, which is the honest outcome rather than a reason to reach for the
 * listing year.
 */
export function extractPeriodOfSignificance(
  text: string,
  options: { readonly maxYear?: number } = {},
): PeriodOfSignificance | undefined {
  if (!text.trim()) return undefined;
  const maxYear = options.maxYear ?? new Date().getUTCFullYear();

  // The form field first. A short window: the field is followed on the form by "Significant
  // Dates", and a wide window would swallow those.
  const field = readWindow(text, FIELD_CUE, 'field', maxYear, 60);
  if (field) return field;

  const justification = readWindow(text, JUSTIFICATION_CUE, 'justification', maxYear, 120);
  if (justification) return justification;

  const construction = CONSTRUCTION_CUE.exec(text);
  if (construction?.[1]) {
    const excluded = calendarDateYears(construction[0]);
    const year = Number.parseInt(construction[1], 10);
    if (!excluded.has(construction[1]) && plausible(year, year, maxYear)) {
      return {
        startYear: year,
        endYear: year,
        method: 'construction',
        evidence: construction[0].trim(),
      };
    }
  }
  return undefined;
}

/** Decade bucket labels a period spans, e.g. 1929-1950 -> 1920s..1950s. */
export function decadeBucketsForPeriod(period: PeriodOfSignificance): readonly string[] {
  const first = Math.floor(period.startYear / 10) * 10;
  const last = Math.floor(period.endYear / 10) * 10;
  const buckets: string[] = [];
  for (let decade = first; decade <= last; decade += 10) buckets.push(`${decade}s`);
  return buckets;
}

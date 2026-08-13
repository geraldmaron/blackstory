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
 *   'context'      a year sitting next to a period-of-significance heading that matched neither
 *                  shape above — OCR routinely mangles the form's layout. Weaker than the two
 *                  above but still period evidence, and worth 94 records that would otherwise go
 *                  undated.
 *   'construction'  "built in 1888" / "constructed c. 1902". NOT an era, and OFF BY DEFAULT.
 *                  It dates the fabric, not the significance, and measurement showed those are
 *                  usually different facts — see `allowConstructionFallback`.
 *
 * THE LISTING DATE MUST NEVER BE READ AS ERA. That confusion is the whole reason this exists, so
 * matching is confined to a window after a period-of-significance cue rather than run over the
 * document, and any year inside a full calendar date ("April 12, 2001") is discarded — listing
 * dates are written that way on the form and periods of significance never are.
 */

/** Years a nomination can plausibly assert. NRHP covers pre-contact through the recent past. */
const MIN_YEAR = 1500;

export type PeriodMethod = 'field' | 'justification' | 'context' | 'construction';

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
const CALENDAR_DATE =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*(\d{4})\b/gi;

const YEAR = /\b(1[5-9]\d{2}|20[0-2]\d)\b/g;
/** "1929-1950", "1910–1955", "1929 to 1950". */
const RANGE = /\b(1[5-9]\d{2}|20[0-2]\d)\s*(?:-|–|—|\bto\b)\s*(1[5-9]\d{2}|20[0-2]\d)\b/;

/**
 * The transcribed form field, which is "Period of Significance" followed straight by the years.
 *
 * The lookahead for a digit is what separates the field from prose, and it has to be positive
 * rather than a list of prose words to exclude. Excluding "(justification)" alone was not enough:
 * `exec` scans the whole document, so on a nomination whose field OCR'd badly it simply found the
 * later sentence "the period of significance is the years 1910-1955" and reported those years as
 * a form field. Same years, wrong provenance — and provenance is the point of recording a method.
 */
const FIELD_CUE = /period\s+of\s+significance\s*:?\s*(?=\d{4})/i;
const JUSTIFICATION_CUE =
  /period\s+of\s+significance\b[^.]{0,40}?(?:begins?|is|spans?|covers?|runs?|extends?)\b/i;
/** Any period-of-significance heading, for the last period-derived reading before giving up. */
const CONTEXT_CUE = /period\s+of\s+significance/i;
const CONSTRUCTION_CUE =
  /\b(?:built|constructed|erected|completed|established|founded)\b(?:\s+\w+){0,3}?\s+(?:in\s+|c\.?\s*|ca\.?\s*|circa\s+)?(1[5-9]\d{2}|20[0-2]\d)\b/i;

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

/**
 * Try every occurrence of the cue, not just the first.
 *
 * A nomination names its period of significance more than once — the form field, then the
 * Section 8 justification. When the first mention OCR'd without readable years, stopping there
 * threw away a perfectly good later one.
 */
function readWindow(
  text: string,
  cue: RegExp,
  method: PeriodMethod,
  maxYear: number,
  windowChars: number,
): PeriodOfSignificance | undefined {
  const scanner = new RegExp(cue.source, cue.flags.includes('g') ? cue.flags : `${cue.flags}g`);
  for (const cueMatch of text.matchAll(scanner)) {
    const found = readAt(text, cueMatch.index + cueMatch[0].length, method, maxYear, windowChars);
    if (found) return found;
  }
  return undefined;
}

function readAt(
  text: string,
  from: number,
  method: PeriodMethod,
  maxYear: number,
  windowChars: number,
): PeriodOfSignificance | undefined {
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
  options: {
    readonly maxYear?: number;
    /**
     * Accept a construction date when no period of significance is stated. DEFAULT FALSE, and it
     * should stay false for anything that feeds `eraBuckets`.
     *
     * It reads like a safe fallback and is not. Measured across the 345 captured nominations that
     * state both, the construction year falls inside the stated period of significance just 38.3%
     * of the time; it predates it in 41.7% of cases by a median of 30 years and a maximum of 369.
     * nrhp-black-heritage-00000731 is the case that decides it: built 1873, significant 1964. Era
     * from construction would file a Civil Rights Act-era record under the 1870s, where nobody
     * browsing the 1960s would ever find it.
     *
     * So a construction date is not a partial view of the era — it is a different fact that
     * usually disagrees with it. Publish it as a sourced claim about the building instead.
     */
    readonly allowConstructionFallback?: boolean;
  } = {},
): PeriodOfSignificance | undefined {
  if (!text.trim()) return undefined;
  const maxYear = options.maxYear ?? new Date().getUTCFullYear();

  // The form field first. A short window: the field is followed on the form by "Significant
  // Dates", and a wide window would swallow those.
  const field = readWindow(text, FIELD_CUE, 'field', maxYear, 60);
  if (field) return field;

  const justification = readWindow(text, JUSTIFICATION_CUE, 'justification', maxYear, 120);
  if (justification) return justification;

  const context = readWindow(text, CONTEXT_CUE, 'context', maxYear, 80);
  if (context) return context;

  if (options.allowConstructionFallback !== true) return undefined;

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

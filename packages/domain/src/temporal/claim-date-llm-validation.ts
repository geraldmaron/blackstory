/**
 * Deterministic validation for Stage 2 LLM claim-date extraction (EDC span anchoring).
 * Rejects outputs whose verbatim quote is absent from the claim object, whose offsets
 * disagree, whose EDTF fails parseEdtfLevel1, or whose years are not grounded in the quote.
 */
import { parseEdtfLevel1 } from './edtf.js';
import {
  inferTemporalProperty,
  type TemporalQualifierProperty,
} from './predicate-temporal-hints.js';
import { parseCleanClaimObjectDate } from './claim-date.js';

export type ClaimDateCharOffsets = {
  readonly start: number;
  readonly end: number;
};

export type LlmClaimDateExtraction = {
  readonly edtf: string;
  readonly property: TemporalQualifierProperty;
  readonly verbatimQuote: string;
  readonly charOffsets: ClaimDateCharOffsets;
};

export type LlmClaimDateValidationResult =
  | {
      readonly ok: true;
      readonly parsed: NonNullable<ReturnType<typeof parseEdtfLevel1>>;
      readonly extraction: LlmClaimDateExtraction;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

const YEAR_IN_PROSE_RE = /\b(1[0-9]{3}|20[0-9]{2})\b/gu;
const FOUR_DIGIT_RE = /\d{4}/gu;
const THREE_DIGIT_PREFIX_RE = /\d{3}(?=X)/gu;

/** True when object prose contains a recoverable year but is not a Stage 1 clean date. */
export function isYearBearingProseClaimObject(object: string): boolean {
  const trimmed = object.trim();
  if (!trimmed || parseCleanClaimObjectDate(trimmed)) return false;
  YEAR_IN_PROSE_RE.lastIndex = 0;
  return YEAR_IN_PROSE_RE.test(trimmed);
}

function collectFourDigitYears(text: string): readonly string[] {
  const years = new Set<string>();
  for (const match of text.matchAll(FOUR_DIGIT_RE)) {
    years.add(match[0]!);
  }
  return [...years];
}

function collectEdtfYearTokens(edtf: string): readonly string[] {
  const tokens = new Set<string>();
  for (const match of edtf.matchAll(FOUR_DIGIT_RE)) {
    tokens.add(match[0]!);
  }
  THREE_DIGIT_PREFIX_RE.lastIndex = 0;
  for (const match of edtf.matchAll(THREE_DIGIT_PREFIX_RE)) {
    tokens.add(match[0]!);
  }
  return [...tokens];
}

/** Every year token in EDTF must appear in the anchored quote (model never invents years). */
export function edtfYearsGroundedInQuote(edtf: string, verbatimQuote: string): boolean {
  const quoteYears = collectFourDigitYears(verbatimQuote);
  const quoteText = verbatimQuote;
  for (const token of collectEdtfYearTokens(edtf)) {
    if (token.length === 4) {
      if (!quoteYears.includes(token)) return false;
      continue;
    }
    if (!quoteText.includes(token)) return false;
  }
  return collectEdtfYearTokens(edtf).length > 0;
}

/** Locates the first verbatim occurrence of quote within claimObject. */
export function findVerbatimQuoteSpan(
  claimObject: string,
  verbatimQuote: string,
): ClaimDateCharOffsets | null {
  const quote = verbatimQuote.trim();
  if (!quote) return null;
  const start = claimObject.indexOf(quote);
  if (start < 0) return null;
  return { start, end: start + quote.length };
}

function normalizeProperty(value: unknown): TemporalQualifierProperty | null {
  if (value === 'point_in_time' || value === 'start' || value === 'end') return value;
  return null;
}

/** Parses untrusted LLM JSON into a typed extraction, without validating spans yet. */
export function parseLlmClaimDateExtractionPayload(
  payload: unknown,
  predicate: string,
): LlmClaimDateExtraction | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const edtf = typeof record.edtf === 'string' ? record.edtf.trim() : '';
  const quote =
    typeof record.verbatim_quote === 'string'
      ? record.verbatim_quote
      : typeof record.verbatimQuote === 'string'
        ? record.verbatimQuote
        : '';
  const property =
    normalizeProperty(record.property) ??
    normalizeProperty(record.qualifier_type) ??
    inferTemporalProperty(predicate);
  const offsetsRaw = record.char_offsets ?? record.charOffsets;
  if (!edtf || !quote || !offsetsRaw || typeof offsetsRaw !== 'object') return null;
  const offsets = offsetsRaw as Record<string, unknown>;
  const start = offsets.start;
  const end = offsets.end;
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isInteger(start) ||
    !Number.isInteger(end)
  ) {
    return null;
  }
  return {
    edtf,
    property,
    verbatimQuote: quote,
    charOffsets: { start, end },
  };
}

/** Deterministic gate: accept only anchored, parseable, quote-grounded extractions. */
export function validateLlmClaimDateExtraction(
  claimObject: string,
  extraction: LlmClaimDateExtraction,
): LlmClaimDateValidationResult {
  const errors: string[] = [];
  const quote = extraction.verbatimQuote.trim();
  if (!quote) errors.push('verbatim_quote is empty');

  const span = findVerbatimQuoteSpan(claimObject, quote);
  if (!span) {
    errors.push('verbatim_quote not found verbatim in claim object');
  } else if (
    span.start !== extraction.charOffsets.start ||
    span.end !== extraction.charOffsets.end
  ) {
    errors.push('char_offsets do not match verbatim quote span in claim object');
  }

  const parsed = parseEdtfLevel1(extraction.edtf);
  if (!parsed) errors.push('edtf fails parseEdtfLevel1');

  if (parsed && !edtfYearsGroundedInQuote(extraction.edtf, quote)) {
    errors.push('edtf year tokens not grounded in verbatim_quote');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, parsed: parsed!, extraction: { ...extraction, verbatimQuote: quote } };
}

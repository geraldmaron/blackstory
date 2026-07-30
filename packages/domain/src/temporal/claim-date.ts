/**
 * Deterministic claim-object date parsing for Stage 1 promotion into claim_qualifiers.
 * Handles the ~261 clean date objects (bare years, Month DD YYYY, ISO dates).
 */
import type { DatePrecision } from '../era.js';
import { parseEdtfLevel1 } from './edtf.js';
import { inferTemporalProperty, type TemporalQualifierProperty } from './predicate-temporal-hints.js';

export type ClaimDateParseResult = {
  readonly edtf: string;
  readonly precision: DatePrecision;
};

export type ClaimTemporalQualifierDraft = {
  readonly qualifierType: 'temporal';
  readonly property: TemporalQualifierProperty;
  readonly value: {
    readonly edtf: string;
    readonly precision: DatePrecision;
    readonly provenance: 'deterministic';
    readonly source: 'claim_object';
  };
};

const BARE_YEAR_RE = /^(1[0-9]{3}|20[0-9]{2})$/u;
const ISO_DATE_RE = /^(1[0-9]{3}|20[0-9]{2})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/u;

const MONTH_NAMES: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const MONTH_DAY_YEAR_RE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(1[0-9]{3}|20[0-9]{2})$/u;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Parses a claim_versions.object string when it is a clean standalone date (not prose).
 * Returns null for non-date objects — Stage 2 LLM handles those.
 */
export function parseCleanClaimObjectDate(object: string): ClaimDateParseResult | null {
  const trimmed = object.trim();
  if (!trimmed) return null;

  if (BARE_YEAR_RE.test(trimmed)) {
    const parsed = parseEdtfLevel1(trimmed);
    if (!parsed) return null;
    return { edtf: parsed.edtf, precision: 'year' };
  }

  if (ISO_DATE_RE.test(trimmed)) {
    const parsed = parseEdtfLevel1(trimmed);
    if (!parsed) return null;
    return { edtf: parsed.edtf, precision: 'day' };
  }

  const monthMatch = MONTH_DAY_YEAR_RE.exec(trimmed);
  if (monthMatch) {
    const month = MONTH_NAMES[monthMatch[1]!.toLowerCase()];
    const day = Number.parseInt(monthMatch[2]!, 10);
    const year = monthMatch[3]!;
    if (month === undefined || !Number.isFinite(day)) return null;
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    const parsed = parseEdtfLevel1(iso);
    if (!parsed) return null;
    return { edtf: parsed.edtf, precision: 'day' };
  }

  return null;
}

/** True when predicate matches a founding-family pattern (may co-occur with a bare year object). */
export function isFoundingFamilyPredicate(predicate: string): boolean {
  return inferTemporalProperty(predicate) === 'start' &&
    /\b(founded|founded_year|founded_in|co[- ]founded|established|organized|incorporated)\b/u.test(
      predicate.toLowerCase(),
    );
}

/** Builds a claim_qualifiers draft row from predicate + object when Stage 1 rules match. */
export function buildClaimTemporalQualifierDraft(
  predicate: string,
  object: string,
): ClaimTemporalQualifierDraft | null {
  const parsed = parseCleanClaimObjectDate(object);
  if (!parsed) return null;
  return {
    qualifierType: 'temporal',
    property: inferTemporalProperty(predicate),
    value: {
      edtf: parsed.edtf,
      precision: parsed.precision,
      provenance: 'deterministic',
      source: 'claim_object',
    },
  };
}

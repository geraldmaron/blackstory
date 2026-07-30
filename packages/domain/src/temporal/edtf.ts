/**
 * EDTF Level 1 parse/validate/normalize for BlackStory temporal fields.
 * Wraps the `edtf` package; rejects seasons and most Level 2 constructs at the boundary,
 * except open-interval bracket forms such as `[..1865]` required by the owner-ratified examples.
 */
import edtfLib, { parse as edtfParse, type EdtfParsed } from 'edtf';
import type { DatePrecision } from '../era.js';

/** Proleptic Gregorian calendar — see migration comment on entity_locations.valid_span. */
export const TEMPORAL_CALENDAR_MODEL = 'proleptic_gregorian' as const;

export type TemporalCalendarModel = typeof TEMPORAL_CALENDAR_MODEL;

export type EdtfBounds = {
  readonly earliest: string;
  readonly latest: string;
};

export type EdtfParseResult = {
  readonly edtf: string;
  readonly precision: DatePrecision;
  readonly bounds: EdtfBounds;
  readonly calendarModel: TemporalCalendarModel;
};

const LEVEL1_TYPES = ['Date', 'Year', 'Decade', 'Century', 'Interval'] as const;
const LEVEL2_OPEN_INTERVAL_TYPES = [...LEVEL1_TYPES, 'List', 'Set'] as const;

const OPEN_INTERVAL_BRACKET_RE = /^\[\.\./u;

function isoDateFromMillis(ms: number, role: 'earliest' | 'latest'): string {
  if (ms === Number.NEGATIVE_INFINITY || ms === Number.POSITIVE_INFINITY || !Number.isFinite(ms)) {
    return role === 'earliest' ? '0001-01-01' : '9999-12-31';
  }
  return new Date(ms).toISOString().slice(0, 10);
}

function precisionFromEdtf(normalized: string, type: string): DatePrecision {
  if (type === 'Decade' || /\d{3}X/u.test(normalized)) return 'decade';
  if (normalized.includes('~') || normalized.includes('%')) return 'circa';
  if (/^\d{4}$/u.test(normalized)) return 'year';
  if (/^\d{4}-\d{2}$/u.test(normalized)) return 'month';
  if (/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return 'day';
  if (OPEN_INTERVAL_BRACKET_RE.test(normalized) || /\/\d{4}$/u.test(normalized)) return 'year';
  return 'year';
}

function parseWithConstraints(input: string): EdtfParsed | null {
  try {
    return edtfParse(input, { level: 1, types: [...LEVEL1_TYPES] });
  } catch {
    if (!OPEN_INTERVAL_BRACKET_RE.test(input) && !/\.\.\]$/u.test(input)) return null;
    try {
      return edtfParse(input, { level: 2, types: [...LEVEL2_OPEN_INTERVAL_TYPES] });
    } catch {
      return null;
    }
  }
}

function toParseResult(parsed: EdtfParsed): EdtfParseResult | null {
  if (parsed.type === 'Season') return null;
  const value = edtfLib(parsed);
  const bounds: EdtfBounds = {
    earliest: isoDateFromMillis(value.min, 'earliest'),
    latest: isoDateFromMillis(value.max, 'latest'),
  };
  return {
    edtf: value.edtf,
    precision: precisionFromEdtf(value.edtf, parsed.type),
    bounds,
    calendarModel: TEMPORAL_CALENDAR_MODEL,
  };
}

/**
 * Parses and normalizes an owner-ratified EDTF string. Returns null when input is empty or fails
 * validation — callers must never persist unvalidated strings.
 */
export function parseEdtfLevel1(input: string): EdtfParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parseWithConstraints(trimmed);
  if (!parsed) return null;
  return toParseResult(parsed);
}

/** Strict parse — throws when EDTF validation fails. */
export function assertEdtfLevel1(input: string): EdtfParseResult {
  const result = parseEdtfLevel1(input);
  if (!result) throw new Error(`Invalid EDTF Level 1 string: ${input}`);
  return result;
}

/** Returns inclusive ISO-date bounds for overlap indexing, or null when parse fails. */
export function edtfBounds(input: string): EdtfBounds | null {
  return parseEdtfLevel1(input)?.bounds ?? null;
}

/** Builds a Postgres daterange literal string from inclusive ISO bounds. */
export function boundsToDaterangeLiteral(bounds: EdtfBounds): string {
  return `[${bounds.earliest},${bounds.latest}]`;
}

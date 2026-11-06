/**
 * Collection period: an inclusive range of STORED DECADE-START buckets (`1880`, `1950`, ...).
 *
 * This is not an event date. A record's era buckets (`1880s`) say which decades the archive
 * documents it in; a range over them says "documented in these decades", never "happened in these
 * years". It is also distinct from the origin `from` param (map/list arrival) and from the map's
 * `decade` sweep and population decades, which are separate concepts with separate spellings.
 *
 * Client-safe leaf module: the edge parity port, the Records parser and the Explore parser all
 * read these codecs, so nothing here imports catalog or domain code.
 *
 * Rules:
 *  - a bound is a four-digit multiple of ten in `MIN_DECADE_START..MAX_DECADE_START`;
 *  - a non-empty bound that is not one becomes the finite sentinel `invalid`, which callers turn
 *    into an explicit error state. It never widens to "no range";
 *  - reversed valid bounds normalize to ascending order;
 *  - one-sided ranges are allowed;
 *  - with an active range, records without a known decade are excluded unless `includeUndated`;
 *    with no bound, they stay included and `includeUndated` is redundant (dropped canonically).
 */

export const MIN_DECADE_START = 1000;
export const MAX_DECADE_START = 2990;

export const PERIOD_INVALID = 'invalid' as const;

/** `''` (no bound), a decade start such as `'1880'`, or the invalid sentinel. */
export type PeriodBound = '' | typeof PERIOD_INVALID | `${number}`;

export type CollectionPeriod = {
  readonly start: PeriodBound;
  readonly end: PeriodBound;
  readonly includeUndated: boolean;
};

export const EMPTY_PERIOD: CollectionPeriod = Object.freeze({
  start: '',
  end: '',
  includeUndated: false,
});

const FOUR_DIGITS = /^\d{4}$/;
/** An era bucket as stored: `1880s`. Anything else (`Undated`, `1880-1900`) has no decade. */
const DECADE_BUCKET = /^(\d{4})s$/;

export function isDecadeStart(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DECADE_START &&
    value <= MAX_DECADE_START &&
    value % 10 === 0
  );
}

function firstOf(raw: string | readonly string[] | undefined): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  return typeof first === 'string' ? first.trim() : '';
}

/** One bound from raw input. Empty stays empty; anything else not a decade start is `invalid`. */
export function parsePeriodBound(raw: string | readonly string[] | undefined): PeriodBound {
  const value = firstOf(raw);
  if (value === '') return '';
  if (!FOUR_DIGITS.test(value)) return PERIOD_INVALID;
  return isDecadeStart(Number(value)) ? (value as PeriodBound) : PERIOD_INVALID;
}

function parseFlag(raw: string | readonly string[] | undefined): boolean {
  const value = firstOf(raw).toLowerCase();
  return value === '1' || value === 'true';
}

export function periodIsActive(period: CollectionPeriod): boolean {
  return period.start !== '' || period.end !== '';
}

export function periodIsInvalid(period: CollectionPeriod): boolean {
  return period.start === PERIOD_INVALID || period.end === PERIOD_INVALID;
}

/** Orders two valid bounds ascending; leaves sentinels and one-sided ranges alone. */
function ordered(start: PeriodBound, end: PeriodBound): Pick<CollectionPeriod, 'start' | 'end'> {
  if (start !== '' && end !== '' && start !== PERIOD_INVALID && end !== PERIOD_INVALID) {
    return Number(start) <= Number(end) ? { start, end } : { start: end, end: start };
  }
  return { start, end };
}

export function normalizePeriod(input: {
  readonly start?: string | readonly string[] | undefined;
  readonly end?: string | readonly string[] | undefined;
  readonly includeUndated?: string | readonly string[] | boolean | undefined;
}): CollectionPeriod {
  const bounds = ordered(parsePeriodBound(input.start), parsePeriodBound(input.end));
  const flag =
    typeof input.includeUndated === 'boolean'
      ? input.includeUndated
      : parseFlag(input.includeUndated);
  const active = bounds.start !== '' || bounds.end !== '';
  return { ...bounds, includeUndated: active && flag };
}

/** Decade start of a stored bucket (`'1880s'` is `1880`), or `undefined` for anything else. */
export function decadeOfBucket(bucket: string): number | undefined {
  const match = DECADE_BUCKET.exec(bucket);
  if (!match) return undefined;
  const year = Number(match[1]);
  return isDecadeStart(year) ? year : undefined;
}

/** Known decade starts among a record's era buckets, ascending and distinct. */
export function documentedDecades(eraBuckets: readonly string[]): readonly number[] {
  const decades = new Set<number>();
  for (const bucket of eraBuckets) {
    const decade = decadeOfBucket(bucket);
    if (decade !== undefined) decades.add(decade);
  }
  return [...decades].sort((a, b) => a - b);
}

function inRange(decade: number, period: CollectionPeriod): boolean {
  if (period.start !== '' && period.start !== PERIOD_INVALID && decade < Number(period.start)) {
    return false;
  }
  if (period.end !== '' && period.end !== PERIOD_INVALID && decade > Number(period.end)) {
    return false;
  }
  return true;
}

/** Documented decades that fall inside the active range (all of them when there is none). */
export function decadesWithinPeriod(
  eraBuckets: readonly string[],
  period: CollectionPeriod,
): readonly number[] {
  return documentedDecades(eraBuckets).filter((decade) => inRange(decade, period));
}

/**
 * Whether a record belongs under the period. An invalid bound matches nothing: the error state
 * renders instead, and an unreadable range must never read as "everything".
 */
export function matchesPeriod(eraBuckets: readonly string[], period: CollectionPeriod): boolean {
  if (!periodIsActive(period)) return true;
  if (periodIsInvalid(period)) return false;
  const known = documentedDecades(eraBuckets);
  if (known.length === 0) return period.includeUndated;
  return known.some((decade) => inRange(decade, period));
}

export function decadeLabel(decade: number): string {
  return `${decade}s`;
}

/** Plain-language range, e.g. `1880s through 1920s`, `1950s and earlier`. */
export function periodLabel(period: CollectionPeriod): string {
  if (periodIsInvalid(period)) return 'Unreadable decade range';
  const { start, end } = period;
  const base =
    start !== '' && end !== ''
      ? start === end
        ? `Documented in the ${start}s`
        : `Documented ${start}s through ${end}s`
      : start !== ''
        ? `Documented in the ${start}s or later`
        : `Documented in the ${end}s or earlier`;
  return period.includeUndated ? `${base}, plus undated` : base;
}

/** Sparse coverage stays sparse; endpoints plus a count never imply a continuous event span. */
export function documentedCoverageLabel(buckets: readonly string[]): string {
  const labels = documentedDecades(buckets).map(decadeLabel);
  if (labels.length === 0) return 'No recorded decade';
  if (labels.length === 1) return `Archive bucket: ${labels[0]}`;
  if (labels.length <= 3) return `Archive buckets: ${labels.join(' and ')}`;
  return `${labels.length} archive buckets; earliest ${labels[0]}, latest ${labels.at(-1)}`;
}

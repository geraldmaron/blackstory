/**
 * Shared date-precision and era/decade bucket model.
 *
 * Single source of truth for "how precise is this date" and "which decades does this span
 * touch" — consumed by the FactRecord spec, law status badges, era pre-filters, and the
 * entity-lifecycle `statusHistory` records (see `./entity-status.ts`). `deriveEraBuckets`
 * replaces the embeddings-package-local `deriveEraBucket` duplicate previously defined in
 * `packages/firebase/src/embeddings/text.ts` (that file now delegates its decade math to this
 * module — see ADR-015).
 */

/**
 * How precisely a date is known. `circa` marks an approximate date at roughly year-level
 * confidence; it still buckets like `year` — the distinction is presentational, not
 * arithmetic.
 */
export const DATE_PRECISIONS = ['day', 'month', 'year', 'decade', 'circa'] as const;

export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export function isDatePrecision(value: string): value is DatePrecision {
  return (DATE_PRECISIONS as readonly string[]).includes(value);
}

/**
 * A time span at a stated precision, using the same validFrom/validTo idiom already used by
 * EntityAlias, EntityLocation, EntityRelationship.temporal, and the new StatusHistoryEntry
 * (./entity-status.ts) elsewhere in this package. `validTo` omitted or null means the span is a
 * single point in time (validFrom only) e.g. a birth year with no recorded death year, or an
 * event with only a start date.
 */
export type EraSpan = {
  readonly validFrom: string;
  readonly validTo?: string | null;
  readonly datePrecision: DatePrecision;
};

function yearOf(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = /-?\d{1,4}/.exec(value);
  if (!match) return undefined;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : undefined;
}

function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

/** Maps a single year directly to its decade bucket label, e.g. 1957 -> "1950s". */
export function deriveDecadeLabel(year: number): string {
  return decadeLabel(year);
}

/**
 * Maps an era span to every overlapping decade bucket, inclusive of both ends:
 * 1948-1972 => ["1940s", "1950s", "1960s", "1970s"]. A single-point span (validTo omitted or
 * null) yields exactly one bucket. Returns an empty array when neither validFrom nor validTo
 * resolves to a year the caller (e.g. a vector pre-filter) should simply omit era buckets for
 * those entities rather than treating this as an error.
 */
export function deriveEraBuckets(span: EraSpan): readonly string[] {
  const fromYear = yearOf(span.validFrom);
  const toYear = yearOf(span.validTo);
  if (fromYear === undefined && toYear === undefined) return [];

  const lo = Math.min(fromYear ?? toYear!, toYear ?? fromYear!);
  const hi = Math.max(fromYear ?? toYear!, toYear ?? fromYear!);

  const buckets: string[] = [];
  for (let decade = Math.floor(lo / 10) * 10; decade <= Math.floor(hi / 10) * 10; decade += 10) {
    buckets.push(`${decade}s`);
  }
  return buckets;
}

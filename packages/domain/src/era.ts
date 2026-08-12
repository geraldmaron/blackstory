/**
 * Shared date-precision and era/decade bucket model.
 *
 * Single source of truth for "how precise is this date" and "which decades does this span
 * touch" — consumed by the FactRecord spec, law status badges, era pre-filters, and the
 * entity-lifecycle `statusHistory` records (see `./entity-status.ts`). `deriveEraBuckets`
 * replaces the embeddings-package-local `deriveEraBucket` duplicate previously defined in
 * `packages/ops-data/src/embeddings/text.ts` (that file now delegates its decade math to this
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

/** Wall-clock or ISO timestamp used to resolve the current calendar decade ceiling. */
export type DecadeReferenceDate = Date | string;

function toReferenceDate(reference: DecadeReferenceDate = new Date()): Date {
  if (reference instanceof Date) return reference;
  const parsed = new Date(reference);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallbackYear = yearOf(reference);
  if (fallbackYear !== undefined) return new Date(Date.UTC(fallbackYear, 6, 1));
  return new Date();
}

/** Start year of the calendar decade containing `reference` (e.g. mid-2026 → 2020). */
export function calendarDecadeStartYear(reference: DecadeReferenceDate = new Date()): number {
  return Math.floor(toReferenceDate(reference).getUTCFullYear() / 10) * 10;
}

/** Latest decade label that has already started per the calendar (e.g. mid-2026 → "2020s"). */
export function maxDecadeInclusive(reference: DecadeReferenceDate = new Date()): string {
  return deriveDecadeLabel(calendarDecadeStartYear(reference));
}

/** Parses a decade bucket label ("1870s") to its start year; undefined when not a decade label. */
export function decadeStartYearFromLabel(label: string): number | undefined {
  const match = /^(\d{4})s$/.exec(label.trim());
  if (!match) return undefined;
  const start = Number.parseInt(match[1]!, 10);
  return Number.isFinite(start) ? start : undefined;
}

/** True when `decade` is a bucket label at or before the current calendar decade. */
export function isDecadeAtOrBeforeCurrent(
  decade: string,
  reference: DecadeReferenceDate = new Date(),
): boolean {
  const start = decadeStartYearFromLabel(decade);
  if (start === undefined) return false;
  return start <= calendarDecadeStartYear(reference);
}

/** Drops decade labels after the current calendar decade — never surfaces 2030s+ in UI. */
export function filterDecadesAtOrBeforeCurrent(
  decades: readonly string[],
  reference: DecadeReferenceDate = new Date(),
): readonly string[] {
  const maxStart = calendarDecadeStartYear(reference);
  return decades.filter((decade) => {
    const start = decadeStartYearFromLabel(decade);
    return start !== undefined && start <= maxStart;
  });
}

/**
 * Inclusive decade labels from `fromDecade` through `toDecade`, filling every step on the axis,
 * capped at the current calendar decade. Used by history/explore scrubbers so sparse artifact
 * decades still render a continuous rail without inventing future stops.
 */
export function buildInclusiveDecadeRange(
  fromDecade: string,
  toDecade: string,
  reference: DecadeReferenceDate = new Date(),
): readonly string[] {
  const fromStart = decadeStartYearFromLabel(fromDecade);
  const toStart = decadeStartYearFromLabel(toDecade);
  if (fromStart === undefined || toStart === undefined) return [];
  const lo = Math.min(fromStart, toStart);
  const hi = Math.min(Math.max(fromStart, toStart), calendarDecadeStartYear(reference));
  if (lo > hi) return [];
  const labels: string[] = [];
  for (let year = lo; year <= hi; year += 10) {
    labels.push(`${year}s`);
  }
  return labels;
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

/*
 * ---------------------------------------------------------------------------
 * Era evidence: which dates on a record may speak for its historical era
 * ---------------------------------------------------------------------------
 *
 * A record can carry dates that say nothing about when its history happened. The
 * National Register listing date is the motivating case: the NPS weekly-list feed
 * (`scrape-nrhp-black-heritage-roster.ts`) publishes a `Listed Date` and no period of
 * significance, so `deriveCatalogEntityStatus` picks the listing year as `validFrom` and
 * every downstream era derivation reads it as the site's era. That is how a lowcountry
 * cemetery came to be labelled "2000s".
 *
 * The rule below is deliberately evidence-based rather than source-based: a year is a
 * designation year when the record's own claims only ever mention it inside a designation
 * claim. "1907 House", listed in 1979, keeps its 1907 because 1907 is not the listing year;
 * a church listed in 2001 with no other dated claim yields no era at all, which is the
 * honest answer until a period of significance is ingested.
 */

/** Claim predicates that record an administrative designation rather than a historical fact. */
const DESIGNATION_PREDICATE =
  /^(listing|listed|designation|designated|nrhp_listing|national_register_listing)$/i;

/** Designation vocabulary in claim prose, for records whose predicate is less specific. */
const DESIGNATION_TEXT =
  /\bNational (?:Register of Historic Places|Historic Landmark|Register)\b|\blisted on the National Register\b|\bNational Historic Landmark\b/i;

/** Four-digit years a claim can plausibly assert, 1500–2099. */
const CLAIM_YEAR = /\b(1[5-9]\d{2}|20\d{2})\b/g;

/** The slice of a claim this module reads. Structurally compatible with public claim views. */
export type EraEvidenceClaim = {
  readonly predicate?: string;
  readonly object?: string;
};

/** A dated lifecycle span, loosened to the shape both release entries and public views carry. */
export type EraEvidenceSpan = {
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly datePrecision?: string;
};

/** True when a claim records a designation/listing event rather than a historical one. */
export function isDesignationClaim(claim: EraEvidenceClaim): boolean {
  if (DESIGNATION_PREDICATE.test(claim.predicate?.trim() ?? '')) return true;
  return DESIGNATION_TEXT.test(claim.object ?? '');
}

function yearsInClaim(claim: EraEvidenceClaim): readonly string[] {
  return (claim.object ?? '').match(CLAIM_YEAR) ?? [];
}

/**
 * True when `year` is attested only by designation claims. A year no claim mentions is not
 * designation-only — absence of evidence must not silently suppress an authored date.
 */
export function isDesignationOnlyYear(year: string, claims: readonly EraEvidenceClaim[]): boolean {
  let seenInDesignation = false;
  for (const claim of claims) {
    if (!yearsInClaim(claim).includes(year)) continue;
    if (!isDesignationClaim(claim)) return false;
    seenInDesignation = true;
  }
  return seenInDesignation;
}

function spanIsDesignationOnly(
  span: EraEvidenceSpan,
  claims: readonly EraEvidenceClaim[],
): boolean {
  const from = /\d{4}/.exec(span.validFrom ?? '')?.[0];
  const to = /\d{4}/.exec(span.validTo ?? '')?.[0];
  if (from === undefined && to === undefined) return false;
  const years = [from, to].filter((year): year is string => year !== undefined);
  return years.every((year) => isDesignationOnlyYear(year, claims));
}

function bucketsForSpan(span: EraEvidenceSpan): readonly string[] {
  const validFrom = span.validFrom?.trim();
  if (!validFrom || /^undated$/iu.test(validFrom)) return [];
  return deriveEraBuckets({
    validFrom,
    ...(span.validTo !== undefined ? { validTo: span.validTo } : {}),
    datePrecision:
      span.datePrecision && isDatePrecision(span.datePrecision) ? span.datePrecision : 'year',
  });
}

/** Everything a record can offer as evidence of when its history happened. */
export type EraEvidenceInput = {
  /** Authored decade labels. Always authoritative — never second-guessed against claims. */
  readonly eraBuckets?: readonly string[];
  /** `event`-kind records carry their span here instead of in `statusHistory`. */
  readonly eventWindow?: EraEvidenceSpan;
  /** Lifecycle spans, which may hold designation dates and are therefore screened. */
  readonly statusHistory?: readonly EraEvidenceSpan[];
  /** The record's claims, read only to tell designation years from historical ones. */
  readonly claims?: readonly EraEvidenceClaim[];
};

/**
 * Decade buckets a record's dates genuinely support, in precedence order: authored buckets,
 * then the event window, then lifecycle spans that are not designation-only. Returns an empty
 * array when the record documents no historical date — callers render that as "Undated" rather
 * than substituting a date the record never claimed.
 */
export function resolveEraBucketsFromEvidence(input: EraEvidenceInput): readonly string[] {
  const authored = (input.eraBuckets ?? []).map((bucket) => bucket.trim()).filter(Boolean);
  if (authored.length > 0) return filterDecadesAtOrBeforeCurrent(authored);

  if (input.eventWindow) {
    const fromEvent = bucketsForSpan(input.eventWindow);
    if (fromEvent.length > 0) return filterDecadesAtOrBeforeCurrent(fromEvent);
  }

  const claims = input.claims ?? [];
  const buckets = new Set<string>();
  for (const span of input.statusHistory ?? []) {
    if (spanIsDesignationOnly(span, claims)) continue;
    for (const bucket of bucketsForSpan(span)) buckets.add(bucket);
  }
  if (buckets.size === 0) return [];
  return filterDecadesAtOrBeforeCurrent([...buckets].sort((a, b) => a.localeCompare(b)));
}

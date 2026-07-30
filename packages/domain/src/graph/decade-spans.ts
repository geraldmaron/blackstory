/**
 * Derives graph decade-bucket active spans from the union of eraBuckets, statusHistory
 * windows, kind_detail EDTF, location EDTF, and event windows — the publish-time source
 * for `DecadeBucketEntityInput` (closes eraBuckets-only ~26% coverage gap).
 */
import {
  currentStatus,
  PLACE_LIKE_STATUS_KINDS,
  type StatusHistoryEntry,
} from '../entity-status.js';
import { deriveEraBuckets, decadeStartYearFromLabel, type DatePrecision, type EraSpan } from '../era.js';
import { parseEdtfLevel1 } from '../temporal/edtf.js';
import type { DecadeBucketEntityInput } from './decades.js';

export type GraphDecadeSpanInput = {
  readonly entityId: string;
  readonly kind: string;
  readonly eraBuckets?: readonly string[];
  readonly statusHistory?: readonly StatusHistoryEntry<string>[];
  readonly kindDetail?: Readonly<Record<string, unknown>>;
  readonly locationValidFromEdtf?: string | null;
  readonly locationValidToEdtf?: string | null;
  readonly eventWindow?: {
    readonly startAt?: string;
    readonly endAt?: string;
    readonly datePrecision?: DatePrecision;
  };
};

const PLACE_LIKE_KINDS = new Set<string>(PLACE_LIKE_STATUS_KINDS);

function spanFromEdtfBounds(fromEdtf?: string | null, toEdtf?: string | null): EraSpan | undefined {
  const fromBounds = fromEdtf?.trim() ? parseEdtfLevel1(fromEdtf.trim())?.bounds : undefined;
  const toBounds = toEdtf?.trim() ? parseEdtfLevel1(toEdtf.trim())?.bounds : undefined;
  if (!fromBounds && !toBounds) return undefined;
  return {
    validFrom: fromBounds?.earliest ?? toBounds!.earliest,
    validTo: toBounds?.latest ?? fromBounds!.latest,
    datePrecision: 'year',
  };
}

function spanFromEraBuckets(buckets: readonly string[]): EraSpan | undefined {
  const starts = buckets
    .map((label) => decadeStartYearFromLabel(label.trim()))
    .filter((year): year is number => year !== undefined);
  if (starts.length === 0) return undefined;
  starts.sort((a, b) => a - b);
  const first = starts[0]!;
  const last = starts[starts.length - 1]!;
  return {
    validFrom: String(first),
    validTo: String(last + 9),
    datePrecision: 'year',
  };
}

function spansFromStatusHistory(
  kind: string,
  history: readonly StatusHistoryEntry<string>[] | undefined,
): readonly EraSpan[] {
  if (!history?.length) return [];
  const spans: EraSpan[] = [];
  for (const entry of history) {
    if (entry.validFrom === undefined) continue;
    spans.push({
      validFrom: entry.validFrom,
      ...(entry.validTo !== undefined ? { validTo: entry.validTo } : {}),
      datePrecision: entry.datePrecision,
    });
  }
  if (
    PLACE_LIKE_KINDS.has(kind) &&
    history.some((entry) => entry.validTo === undefined || entry.validTo === null) &&
    currentStatus(history) === 'active'
  ) {
    return spans;
  }
  return spans;
}

function spansFromKindDetail(
  kind: string,
  detail: Readonly<Record<string, unknown>> | undefined,
): readonly EraSpan[] {
  if (!detail) return [];
  if (kind === 'person') {
    const birth = typeof detail.birth_edtf === 'string' ? detail.birth_edtf : undefined;
    const death = typeof detail.death_edtf === 'string' ? detail.death_edtf : undefined;
    const span = spanFromEdtfBounds(birth, death);
    return span ? [span] : [];
  }
  const begin = typeof detail.begin_edtf === 'string' ? detail.begin_edtf : undefined;
  const end = typeof detail.end_edtf === 'string' ? detail.end_edtf : undefined;
  const span = spanFromEdtfBounds(begin, end);
  return span ? [span] : [];
}

function spanFromEventWindow(
  eventWindow: GraphDecadeSpanInput['eventWindow'],
): EraSpan | undefined {
  if (!eventWindow?.startAt) return undefined;
  return {
    validFrom: eventWindow.startAt,
    ...(eventWindow.endAt !== undefined ? { validTo: eventWindow.endAt } : {}),
    datePrecision: eventWindow.datePrecision ?? 'year',
  };
}

/** Union temporal sources into deduplicated active spans for decade graph bucketing. */
export function deriveGraphActiveSpans(input: GraphDecadeSpanInput): readonly EraSpan[] {
  const spans: EraSpan[] = [];

  for (const span of spansFromStatusHistory(input.kind, input.statusHistory)) {
    spans.push(span);
  }

  const kindDetailSpans = spansFromKindDetail(input.kind, input.kindDetail);
  for (const span of kindDetailSpans) spans.push(span);

  const locationSpan = spanFromEdtfBounds(input.locationValidFromEdtf, input.locationValidToEdtf);
  if (locationSpan) spans.push(locationSpan);

  const eventSpan = spanFromEventWindow(input.eventWindow);
  if (eventSpan) spans.push(eventSpan);

  if (input.eraBuckets && input.eraBuckets.length > 0) {
    const eraSpan = spanFromEraBuckets(input.eraBuckets);
    if (eraSpan) spans.push(eraSpan);
    for (const bucket of input.eraBuckets) {
      const trimmed = bucket.trim();
      const start = decadeStartYearFromLabel(trimmed);
      if (start === undefined) continue;
      spans.push({
        validFrom: String(start),
        validTo: String(start + 9),
        datePrecision: 'decade',
      });
    }
  }

  const deduped = new Map<string, EraSpan>();
  for (const span of spans) {
    const key = `${span.validFrom}\0${span.validTo ?? ''}\0${span.datePrecision}`;
    deduped.set(key, span);
  }
  return [...deduped.values()];
}

/** Builds a decade-bucket entity input when any recoverable temporal signal exists. */
export function deriveGraphDecadeBucketInput(
  input: GraphDecadeSpanInput,
): DecadeBucketEntityInput | undefined {
  const activeSpans = deriveGraphActiveSpans(input);
  if (activeSpans.length === 0) return undefined;
  return { entityId: input.entityId, activeSpans };
}

/** Decade labels implied by active spans (for coverage metrics). */
export function deriveGraphDecadeLabelsFromSpans(
  input: DecadeBucketEntityInput,
  _referenceDate: string,
): readonly string[] {
  const buckets = new Set<string>();
  for (const span of input.activeSpans) {
    for (const bucket of deriveEraBuckets(span)) {
      buckets.add(bucket);
    }
  }
  return [...buckets].sort((a, b) => a.localeCompare(b));
}

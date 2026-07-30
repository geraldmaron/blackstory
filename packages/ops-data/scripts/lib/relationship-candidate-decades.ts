/**
 * Derive inclusive decade buckets for WS4 relationship inference from release projection,
 * status history, kind_detail EDTF, and location EDTF spans.
 */
import {
  currentStatus,
  type StatusHistoryEntry,
} from '../../../domain/src/entity-status.ts';
import {
  deriveEraBuckets,
  filterDecadesAtOrBeforeCurrent,
  maxDecadeInclusive,
} from '../../../domain/src/era.ts';
import { parseEdtfLevel1 } from '../../../domain/src/temporal/edtf.ts';

export type EntityDecadeInput = {
  readonly kind: string;
  readonly eraBuckets?: readonly string[];
  readonly statusHistory?: readonly StatusHistoryEntry<string>[];
  readonly kindDetail?: Readonly<Record<string, unknown>>;
  readonly locationValidFromEdtf?: string | null;
  readonly locationValidToEdtf?: string | null;
  readonly referenceDate?: Date | string;
};

const PLACE_LIKE_KINDS = new Set(['place', 'school', 'organization', 'institution']);

function decadeFromIsoDate(iso: string | undefined): string | undefined {
  if (!iso?.trim()) return undefined;
  const year = Number.parseInt(iso.trim().slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1000 || year > 9999) return undefined;
  return `${Math.floor(year / 10) * 10}s`;
}

function decadesFromEdtfBounds(fromEdtf?: string | null, toEdtf?: string | null): readonly string[] {
  const fromBounds = fromEdtf?.trim() ? parseEdtfLevel1(fromEdtf.trim())?.bounds : undefined;
  const toBounds = toEdtf?.trim() ? parseEdtfLevel1(toEdtf.trim())?.bounds : undefined;
  if (!fromBounds && !toBounds) return [];
  return deriveEraBuckets({
    validFrom: fromBounds?.earliest ?? toBounds!.earliest,
    validTo: toBounds?.latest ?? fromBounds!.latest,
    datePrecision: 'year',
  });
}

function decadesFromKindDetail(kind: string, detail: Readonly<Record<string, unknown>> | undefined): readonly string[] {
  if (!detail) return [];
  if (kind === 'person') {
    const birth = typeof detail.birth_edtf === 'string' ? detail.birth_edtf : undefined;
    const death = typeof detail.death_edtf === 'string' ? detail.death_edtf : undefined;
    return decadesFromEdtfBounds(birth, death);
  }
  const begin = typeof detail.begin_edtf === 'string' ? detail.begin_edtf : undefined;
  const end = typeof detail.end_edtf === 'string' ? detail.end_edtf : undefined;
  return decadesFromEdtfBounds(begin, end);
}

function decadesFromStatusHistory(
  kind: string,
  history: readonly StatusHistoryEntry<string>[] | undefined,
  referenceDate: Date | string,
): readonly string[] {
  if (!history?.length) return [];
  const buckets = new Set<string>();
  for (const entry of history) {
    const fromDecade = decadeFromIsoDate(entry.validFrom);
    if (fromDecade) buckets.add(fromDecade);
    const toDecade = decadeFromIsoDate(entry.validTo ?? undefined);
    if (toDecade) buckets.add(toDecade);
    if (entry.validTo === undefined || entry.validTo === null) {
      if (PLACE_LIKE_KINDS.has(kind) && currentStatus(history) === 'active') {
        buckets.add(maxDecadeInclusive(referenceDate));
      }
    }
  }
  return [...buckets];
}

/** Union decade buckets from all WS4 temporal sources, capped at the current calendar decade. */
export function deriveEntityDecades(input: EntityDecadeInput): readonly string[] {
  const referenceDate = input.referenceDate ?? new Date();
  const buckets = new Set<string>();

  for (const decade of input.eraBuckets ?? []) {
    const trimmed = decade.trim();
    if (trimmed.length > 0) buckets.add(trimmed);
  }

  for (const decade of decadesFromStatusHistory(input.kind, input.statusHistory, referenceDate)) {
    buckets.add(decade);
  }

  for (const decade of decadesFromKindDetail(input.kind, input.kindDetail)) {
    buckets.add(decade);
  }

  for (const decade of decadesFromEdtfBounds(input.locationValidFromEdtf, input.locationValidToEdtf)) {
    buckets.add(decade);
  }

  return filterDecadesAtOrBeforeCurrent([...buckets].sort((a, b) => a.localeCompare(b)), referenceDate);
}

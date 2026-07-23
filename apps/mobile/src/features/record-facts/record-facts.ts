/**
 * Record fact helpers for mobile browse surfaces — era and status labels aligned with
 * web `entity-era-facts.ts` / `entity-record-facts.ts`, backed by `@repo/domain/era`
 * where decade math is shared.
 */
import {
  deriveEraBuckets,
  filterDecadesAtOrBeforeCurrent,
  isDatePrecision,
} from '@repo/domain/era';

export type RecordEraInput = {
  readonly eraBuckets?: readonly string[];
  readonly era?: string;
  readonly eventWindow?: {
    readonly startAt?: string;
    readonly endAt?: string | null;
    readonly datePrecision?: string;
  };
  readonly statusHistory?: readonly {
    readonly validFrom?: string;
    readonly validTo?: string | null;
    readonly datePrecision?: string;
  }[];
};

const KIND_LABELS: Readonly<Record<string, string>> = {
  person: 'Person',
  place: 'Place',
  school: 'School',
  organization: 'Organization',
  institution: 'Institution',
  event: 'Event',
  law: 'Law',
  case: 'Case',
  publication: 'Publication',
  artifact: 'Artifact',
  movement: 'Movement',
  other: 'Record',
};

function normalizeBucketLabel(bucket: string): string | undefined {
  const trimmed = bucket.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}s$/i.test(trimmed)) return trimmed.toLowerCase();
  const decade = Number.parseInt(trimmed, 10);
  if (Number.isFinite(decade) && decade >= 1000 && decade <= 9999) {
    return `${Math.floor(decade / 10) * 10}s`;
  }
  return trimmed;
}

function bucketsFromSpan(validFrom?: string, validTo?: string | null, datePrecision?: string) {
  if (!validFrom?.trim()) return [] as readonly string[];
  const precision = datePrecision && isDatePrecision(datePrecision) ? datePrecision : 'year';
  return deriveEraBuckets({
    validFrom: validFrom.trim(),
    ...(validTo !== undefined ? { validTo } : {}),
    datePrecision: precision,
  });
}

function bucketsFromEraText(era: string): readonly string[] {
  const decadeMatches = era.match(/\d{4}s/gi);
  if (decadeMatches && decadeMatches.length > 0) {
    return decadeMatches.map((match) => match.toLowerCase());
  }
  const yearMatches = era.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g);
  if (yearMatches && yearMatches.length > 0) {
    const decades = yearMatches.map((year) => `${Math.floor(Number.parseInt(year, 10) / 10) * 10}s`);
    return [...new Set(decades)];
  }
  return [];
}

/** Replace unicode dashes with plain " to " for user-facing copy. */
export function plainRangeText(value: string): string {
  return value.replace(/\u2013|\u2014/g, ' to ').replace(/\s+/g, ' ').trim();
}

export function resolveEraBuckets(input: RecordEraInput): readonly string[] {
  const explicit = (input.eraBuckets ?? [])
    .map(normalizeBucketLabel)
    .filter((bucket): bucket is string => bucket !== undefined);
  if (explicit.length > 0) {
    return filterDecadesAtOrBeforeCurrent(explicit);
  }

  const fromEvent = bucketsFromSpan(
    input.eventWindow?.startAt,
    input.eventWindow?.endAt,
    input.eventWindow?.datePrecision,
  );
  if (fromEvent.length > 0) return filterDecadesAtOrBeforeCurrent(fromEvent);

  const history = input.statusHistory ?? [];
  if (history.length > 0) {
    const buckets = new Set<string>();
    for (const entry of history) {
      for (const bucket of bucketsFromSpan(entry.validFrom, entry.validTo, entry.datePrecision)) {
        buckets.add(bucket);
      }
    }
    if (buckets.size > 0) {
      return filterDecadesAtOrBeforeCurrent([...buckets].sort((a, b) => a.localeCompare(b)));
    }
  }

  const era = input.era?.trim() ?? '';
  if (era.length > 0 && !/^unknown$/iu.test(era) && !/^undated$/iu.test(era)) {
    const fromText = bucketsFromEraText(era);
    if (fromText.length > 0) return filterDecadesAtOrBeforeCurrent(fromText);
  }

  return [];
}

/** Human-readable era label; never "Undated" when legacy era text exists. */
export function recordEraLabel(input: RecordEraInput): string {
  const buckets = resolveEraBuckets(input);
  if (buckets.length > 0) {
    if (buckets.length === 1) return buckets[0]!;
    const first = buckets[0]!;
    const last = buckets[buckets.length - 1]!;
    return plainRangeText(`${first} to ${last}`);
  }

  const era = input.era?.trim() ?? '';
  if (era.length > 0 && !/^unknown$/iu.test(era) && !/^undated$/iu.test(era)) {
    return plainRangeText(era);
  }

  return 'Undated';
}

export function recordKindLabel(kind: string): string {
  const normalized = kind.trim().toLowerCase();
  return KIND_LABELS[normalized] ?? humanizeToken(kind);
}

export function recordStatusLabel(status: string | undefined): string | undefined {
  const trimmed = status?.trim();
  if (!trimmed) return undefined;
  return humanizeToken(trimmed);
}

function humanizeToken(value: string): string {
  return value
    .split(/[_-]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

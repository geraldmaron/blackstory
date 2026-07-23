/**
 * Shared era resolution for record cards, rip rows, and anatomy panels.
 * Prefers structured `eraBuckets`; falls back to event/status spans and legacy `era` text
 * before showing "Undated".
 */
import { deriveEraBuckets, filterDecadesAtOrBeforeCurrent, isDatePrecision } from '@repo/domain/era';
import { eraFactLink } from './metadata-hrefs';

export type EntityEraInput = {
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

/** Resolve decade bucket labels from any public entity era fields. */
export function resolveEntityEraBuckets(input: EntityEraInput): readonly string[] {
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

export type EntityEraFact = {
  readonly label: string;
  readonly href?: string;
};

/** Human-readable era label + optional explore href; never "Undated" when legacy era text exists. */
export function entityEraFact(input: EntityEraInput): EntityEraFact {
  const buckets = resolveEntityEraBuckets(input);
  if (buckets.length > 0) {
    const link = eraFactLink(buckets);
    return {
      label: link.label.replace(/\u2013|\u2014/g, ' to ').replace(/\s+/g, ' ').trim(),
      ...(link.href !== undefined ? { href: link.href } : {}),
    };
  }

  const era = input.era?.trim() ?? '';
  if (era.length > 0 && !/^unknown$/iu.test(era) && !/^undated$/iu.test(era)) {
    return { label: era.replace(/\u2013|\u2014/g, ' to ') };
  }

  return { label: 'Undated' };
}

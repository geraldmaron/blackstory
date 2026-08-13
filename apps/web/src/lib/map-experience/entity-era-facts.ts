/**
 * Shared era resolution for record cards, rip rows, and anatomy panels.
 * Prefers structured `eraBuckets`; falls back to event/status spans, historical claim years,
 * and legacy `era` text before reporting the era as undocumented.
 *
 * Span screening lives in `@repo/domain`'s `resolveEraEvidence`, shared with the release builder:
 * a date that only ever appears in a designation claim (a National Register listing, say) is not
 * evidence of when the record's history happened, so it yields no era.
 */
import {
  type EraDocumentationState,
  type EraEvidenceInput,
  filterDecadesAtOrBeforeCurrent,
  resolveEraEvidence,
} from '@repo/domain/era';
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
  /** Read only to tell designation dates from historical ones; never rendered from here. */
  readonly claims?: readonly {
    readonly predicate?: string;
    readonly object?: string;
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

function bucketsFromEraText(era: string): readonly string[] {
  const decadeMatches = era.match(/\d{4}s/gi);
  if (decadeMatches && decadeMatches.length > 0) {
    return decadeMatches.map((match) => match.toLowerCase());
  }
  const yearMatches = era.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g);
  if (yearMatches && yearMatches.length > 0) {
    const decades = yearMatches.map(
      (year) => `${Math.floor(Number.parseInt(year, 10) / 10) * 10}s`,
    );
    return [...new Set(decades)];
  }
  return [];
}

/** Translate the web's era input shape into the shared domain evidence shape. */
function toEvidenceInput(input: EntityEraInput): EraEvidenceInput {
  const explicit = (input.eraBuckets ?? [])
    .map(normalizeBucketLabel)
    .filter((bucket): bucket is string => bucket !== undefined);

  return {
    ...(explicit.length > 0 ? { eraBuckets: explicit } : {}),
    ...(input.eventWindow !== undefined
      ? {
          eventWindow: {
            ...(input.eventWindow.startAt !== undefined
              ? { validFrom: input.eventWindow.startAt }
              : {}),
            ...(input.eventWindow.endAt !== undefined ? { validTo: input.eventWindow.endAt } : {}),
            ...(input.eventWindow.datePrecision !== undefined
              ? { datePrecision: input.eventWindow.datePrecision }
              : {}),
          },
        }
      : {}),
    ...(input.statusHistory !== undefined ? { statusHistory: input.statusHistory } : {}),
    ...(input.claims !== undefined ? { claims: input.claims } : {}),
  };
}

/**
 * Why this record carries no era. Legacy free-text `era` counts as documented even when it is
 * too vague to bucket, since the record does say something about when.
 */
function eraDocumentationState(input: EntityEraInput): EraDocumentationState {
  return resolveEraEvidence(toEvidenceInput(input)).state;
}

/** Resolve decade bucket labels from any public entity era fields. */
export function resolveEntityEraBuckets(input: EntityEraInput): readonly string[] {
  const fromEvidence = resolveEraEvidence(toEvidenceInput(input)).buckets;
  if (fromEvidence.length > 0) return fromEvidence;

  const era = input.era?.trim() ?? '';
  if (era.length > 0 && !/^unknown$/iu.test(era) && !/^undated$/iu.test(era)) {
    const fromText = bucketsFromEraText(era);
    if (fromText.length > 0) return filterDecadesAtOrBeforeCurrent(fromText);
  }

  return [];
}

/**
 * Shown when a record resolves to no era. It names a gap in the archive rather than a property
 * of the subject: a church listed in 2001 is not undated, we just have not documented when its
 * history happened. `state` carries which kind of gap for callers that triage the backlog.
 */
export const ERA_NOT_DOCUMENTED_LABEL = 'Era not documented';

export type EntityEraFact = {
  readonly label: string;
  readonly href?: string;
  readonly state: EraDocumentationState;
};

/** Human-readable era label + optional explore href, plus why an absent era is absent. */
export function entityEraFact(input: EntityEraInput): EntityEraFact {
  const buckets = resolveEntityEraBuckets(input);
  if (buckets.length > 0) {
    const link = eraFactLink(buckets);
    return {
      /*
       * The hyphen is in this pattern because `eraFactLink` builds this exact label as
       * `${first}-${last}` \u2014 we generate the separator, so we can safely spell it back out as
       * "to". The arbitrary-era branch below deliberately does NOT strip hyphens: that string
       * comes from the record, and an era written "mid-1800s" would become "mid to 1800s".
       */
      label: link.label
        .replace(/\u2013|\u2014|-/g, ' to ')
        .replace(/\s+/g, ' ')
        .trim(),
      ...(link.href !== undefined ? { href: link.href } : {}),
      state: 'documented',
    };
  }

  const era = input.era?.trim() ?? '';
  if (era.length > 0 && !/^unknown$/iu.test(era) && !/^undated$/iu.test(era)) {
    return { label: era.replace(/\u2013|\u2014/g, ' to '), state: 'documented' };
  }

  return { label: ERA_NOT_DOCUMENTED_LABEL, state: eraDocumentationState(input) };
}

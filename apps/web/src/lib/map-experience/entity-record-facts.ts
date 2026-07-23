/**
 * Format record facts for rip rows and anatomy panels (kind, era, match line).
 * Pure helpers — safe for server components and unit tests.
 */
import type { SearchRecommendation, SearchResultView } from '@repo/domain';
import { displayEncodingFor } from './kind-encoding';
import { entityEraFact } from './entity-era-facts';

export type SearchRipFactEra = {
  readonly label: string;
  readonly href?: string;
};

/** Human-readable kind label from the shared encoding vocabulary. */
export function searchKindLabelFor(kind: string): string {
  return displayEncodingFor(kind).label;
}

/** Era label + optional explore href from era buckets or legacy era text. */
export function searchEraFactFor(
  eraBuckets: readonly string[],
  era?: string,
): SearchRipFactEra {
  return entityEraFact({
    eraBuckets,
    ...(era !== undefined ? { era } : {}),
  });
}

/** Hide "Matched:" when it only repeats the title. */
export function searchMatchedLine(
  displayName: string,
  matchedText: string | undefined,
): string | undefined {
  const matched = matchedText?.trim();
  if (!matched) return undefined;
  if (matched.toLowerCase() === displayName.trim().toLowerCase()) return undefined;
  return matched;
}

export type SearchRipItem = Pick<
  SearchResultView,
  'id' | 'kind' | 'displayName' | 'summary' | 'status' | 'eraBuckets' | 'matchedText'
>;

export type SearchRecommendationRipItem = Pick<
  SearchRecommendation,
  'id' | 'kind' | 'displayName' | 'summary' | 'jurisdictionState'
>;

/** Whether any search param differs from the default empty browse state. */
export function searchHasActiveFilters(input: {
  readonly q: string;
  readonly kind: string;
  readonly status: string;
  readonly era: string;
}): boolean {
  return (
    input.q.trim().length > 0 ||
    input.kind !== 'all' ||
    input.status !== 'all' ||
    input.era !== 'all'
  );
}

/** Whether any history browse filter differs from defaults (unified find-in-time surface). */
export function historyHasActiveFilters(input: {
  readonly q: string;
  readonly kind: string;
  readonly status: string;
  readonly era: string;
  readonly topic: string;
  readonly connections: string;
}): boolean {
  return (
    input.q.trim().length > 0 ||
    input.kind !== 'all' ||
    input.status !== 'all' ||
    input.era !== 'all' ||
    input.topic !== 'all' ||
    input.connections !== 'all'
  );
}

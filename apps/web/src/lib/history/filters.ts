/**
 * Filter state for the `/history` browse surface. Mirrors facet convention
 * (`../map-experience/filters.ts`) but scoped to graph-node kind filtering only decade selection
 * lives in URL state separately (`./url-state.ts`).
 */

export type HistoryKindFilter = 'all' | 'place' | 'school' | 'event' | 'institution';

export type HistoryFilterState = {
  readonly kind: HistoryKindFilter;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  kind: 'all',
};

export type HistoryFacetOption = {
  readonly value: string;
  readonly label: string;
};

export function buildHistoryKindFacetOptions(
  kinds: readonly string[],
): readonly HistoryFacetOption[] {
  const unique = [...new Set(kinds)].sort();
  return [
    { value: 'all', label: 'All kinds' },
    ...unique.map((kind) => ({
      value: kind,
      label: kind.charAt(0).toUpperCase() + kind.slice(1),
    })),
  ];
}

export function applyHistoryKindFilter<T extends { readonly kind: string }>(
  items: readonly T[],
  filters: HistoryFilterState,
): readonly T[] {
  if (filters.kind === 'all') return items;
  return items.filter((item) => item.kind === filters.kind);
}

/**
 * Filter state for the `/history` browse surface. Mirrors facet convention
 * (`../map-experience/filters.ts`) for kind, plus text query and sort. Decade selection
 * lives in URL state separately (`./url-state.ts`).
 */

export type HistoryKindFilter = 'all' | 'place' | 'school' | 'event' | 'institution';

export type HistorySort = 'name' | 'kind' | 'connections';

export type HistoryFilterState = {
  readonly kind: HistoryKindFilter;
  readonly q: string;
  readonly sort: HistorySort;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  kind: 'all',
  q: '',
  sort: 'name',
};

export const HISTORY_SORT_OPTIONS: readonly { readonly value: HistorySort; readonly label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'kind', label: 'Kind' },
  { value: 'connections', label: 'Connections' },
] as const;

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

export function applyHistoryQueryFilter<
  T extends { readonly displayName: string; readonly summary: string },
>(items: readonly T[], q: string): readonly T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(
    (item) =>
      item.displayName.toLowerCase().includes(needle) ||
      item.summary.toLowerCase().includes(needle),
  );
}

export function parseHistorySort(raw: string | undefined): HistorySort {
  if (raw === 'kind' || raw === 'connections' || raw === 'name') return raw;
  return DEFAULT_HISTORY_FILTERS.sort;
}

export function sortHistoryNodes<
  T extends { readonly displayName: string; readonly kind: string; readonly connectionCount: number },
>(items: readonly T[], sort: HistorySort): readonly T[] {
  const copy = [...items];
  if (sort === 'kind') {
    return copy.sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.displayName.localeCompare(b.displayName),
    );
  }
  if (sort === 'connections') {
    return copy.sort(
      (a, b) => b.connectionCount - a.connectionCount || a.displayName.localeCompare(b.displayName),
    );
  }
  return copy.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

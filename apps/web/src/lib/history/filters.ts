/**
 * Filter state for the `/history` browse surface. Mirrors facet convention
 * (`../map-experience/filters.ts`) for kind, status, topic, and connections, plus text query
 * and sort. Decade selection lives in URL state separately (`./url-state.ts`).
 */

export type HistoryKindFilter = 'all' | 'place' | 'school' | 'event' | 'institution';

export type HistorySort = 'name' | 'kind' | 'connections';

export type HistoryConnectionsFilter = 'all' | 'with' | 'without';

export type HistoryFilterState = {
  readonly kind: HistoryKindFilter;
  readonly q: string;
  readonly sort: HistorySort;
  /** `'all'` or a slug derived from `statusLabel` via {@link statusLabelToSlug}. */
  readonly status: string;
  /** `'all'` or a topic tag present on the record. */
  readonly topic: string;
  readonly connections: HistoryConnectionsFilter;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  kind: 'all',
  q: '',
  sort: 'name',
  status: 'all',
  topic: 'all',
  connections: 'all',
};

export const HISTORY_SORT_OPTIONS: readonly { readonly value: HistorySort; readonly label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'kind', label: 'Kind' },
  { value: 'connections', label: 'Connections' },
] as const;

export type HistoryFacetOption = {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
};

/** Stable URL/facet slug for multi-word status labels (lowercase, hyphen-separated). */
export function statusLabelToSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

export function buildHistoryKindFacetOptionsWithCounts(
  nodes: readonly { readonly kind: string }[],
): readonly HistoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  }
  const options = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => ({
      value: kind,
      label: kind.charAt(0).toUpperCase() + kind.slice(1),
      count,
    }));
  return [{ value: 'all', label: 'All kinds' }, ...options];
}

export function buildHistoryStatusFacetOptions(
  nodes: readonly { readonly statusLabel: string }[],
): readonly HistoryFacetOption[] {
  const counts = new Map<string, { readonly label: string; readonly count: number }>();
  for (const node of nodes) {
    const value = statusLabelToSlug(node.statusLabel);
    const existing = counts.get(value);
    if (existing) {
      counts.set(value, { label: existing.label, count: existing.count + 1 });
    } else {
      counts.set(value, { label: node.statusLabel, count: 1 });
    }
  }
  const options = [...counts.entries()]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([value, { label, count }]) => ({ value, label, count }));
  return [{ value: 'all', label: 'All statuses' }, ...options];
}

export function buildHistoryTopicFacetOptions(
  nodes: readonly { readonly topicTags: readonly string[] }[],
): readonly HistoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const tag of node.topicTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const options = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({
      value,
      label: value
        .split('-')
        .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' '),
      count,
    }));
  return [{ value: 'all', label: 'All topics' }, ...options];
}

export function applyHistoryKindFilter<T extends { readonly kind: string }>(
  items: readonly T[],
  filters: HistoryFilterState,
): readonly T[] {
  if (filters.kind === 'all') return items;
  return items.filter((item) => item.kind === filters.kind);
}

export function applyHistoryStatusFilter<T extends { readonly statusLabel: string }>(
  items: readonly T[],
  status: string,
): readonly T[] {
  if (status === 'all') return items;
  const needle = status.trim().toLowerCase();
  return items.filter((item) => statusLabelToSlug(item.statusLabel) === needle);
}

export function applyHistoryTopicFilter<T extends { readonly topicTags: readonly string[] }>(
  items: readonly T[],
  topic: string,
): readonly T[] {
  if (topic === 'all') return items;
  return items.filter((item) => item.topicTags.includes(topic));
}

export function applyHistoryConnectionsFilter<
  T extends { readonly connectionCount: number },
>(items: readonly T[], connections: HistoryConnectionsFilter): readonly T[] {
  if (connections === 'all') return items;
  if (connections === 'with') return items.filter((item) => item.connectionCount > 0);
  return items.filter((item) => item.connectionCount === 0);
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

export function parseHistoryConnectionsFilter(raw: string | undefined): HistoryConnectionsFilter {
  if (raw === 'with' || raw === 'without') return raw;
  return DEFAULT_HISTORY_FILTERS.connections;
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

export function trimHistoryEdgesToNodes<
  T extends { readonly fromEntityId: string; readonly toEntityId: string },
>(edges: readonly T[], nodeIds: ReadonlySet<string>): readonly T[] {
  return edges.filter(
    (edge) => nodeIds.has(edge.fromEntityId) && nodeIds.has(edge.toEntityId),
  );
}

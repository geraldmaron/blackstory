/**
 * Filter state for the `/history` browse surface. Mirrors facet convention
 * (`../map-experience/filters.ts`) for kind, status, topic, and connections, plus text query
 * and sort. Decade selection lives in URL state separately (`./url-state.ts`).
 */

/**
 * A kind filter value is one of: `'all'`, a consolidated category id (see
 * {@link HISTORY_KIND_CATEGORIES}), or a single raw entity kind exposed via the advanced
 * "all record types" disclosure. Kept as a broad `string` because both the category ids
 * and the raw kind vocabulary are data-driven and validated against live facet options
 * before application (see `HistoryExperience.handleKindChange`).
 */
export type HistoryKindFilter = string;

export type HistorySort = 'name' | 'kind' | 'connections';

export type HistoryConnectionsFilter = 'all' | 'with' | 'without';

export type HistoryFilterState = {
  readonly kind: HistoryKindFilter;
  readonly q: string;
  readonly sort: HistorySort;
  /** `'all'` or a slug derived from `statusLabel` via {@link statusLabelToSlug}. */
  readonly status: string;
  /** `'all'` or a decade bucket label (e.g. `1860s`). */
  readonly era: string;
  /** `'all'` or a topic tag present on the record. */
  readonly topic: string;
  readonly connections: HistoryConnectionsFilter;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  kind: 'all',
  q: '',
  sort: 'name',
  status: 'all',
  era: 'all',
  topic: 'all',
  connections: 'all',
};

/**
 * Grouping metadata for the `/history` refine panel. Facets are regrouped by the
 * shape of {@link HistoryFilterState} / `HistoryNodeView` rather than presented as a
 * flat row of controls: record identity, temporal/contextual facets, relationship
 * presence, and the large-vocabulary topic tags (deferred into a disclosure). Sort is
 * result ordering, deliberately kept out of the filter groups.
 */
export const HISTORY_FILTER_GROUPS = {
  recordType: { label: 'Record type', facets: ['kind'] },
  timeContext: { label: 'Time & context', facets: ['era', 'status'] },
  relationships: { label: 'Relationships', facets: ['connections'] },
  topics: { label: 'Topics', facets: ['topic'], advanced: true },
} as const;

/**
 * Consolidated record-type taxonomy (repo-k1t9). The published release spans 11 of the 12
 * canonical entity kinds (see `@repo/domain` ENTITY_KINDS), which renders as a wall of ~11
 * kind chips. To keep the primary type filter scannable, related kinds roll up into a small
 * set of high-level categories; the raw kinds stay reachable via an advanced disclosure.
 *
 * Data basis (active release, 1375 records, 2026-07-24):
 *   place 565 · person 394 · event 79 · institution 79 · school 77 · organization 57 ·
 *   case 48 · law 26 · publication 21 · movement 15 · other 14  (artifact 0)
 *
 * Every canonical kind maps to exactly one category (verified by test). This mapping is a
 * product judgment and may be revised after review.
 */
export const HISTORY_KIND_CATEGORIES = [
  { id: 'people', label: 'People', kinds: ['person'] },
  { id: 'places', label: 'Places', kinds: ['place'] },
  {
    id: 'organizations',
    label: 'Organizations',
    kinds: ['school', 'institution', 'organization'],
  },
  { id: 'events', label: 'Events & movements', kinds: ['event', 'movement'] },
  { id: 'law', label: 'Law & courts', kinds: ['law', 'case'] },
  { id: 'works', label: 'Works & other', kinds: ['publication', 'artifact', 'other'] },
] as const;

export type HistoryKindCategoryId = (typeof HISTORY_KIND_CATEGORIES)[number]['id'];

/** Reverse lookup: raw entity kind -> consolidated category id. */
export const HISTORY_KIND_TO_CATEGORY: Readonly<Record<string, HistoryKindCategoryId>> =
  Object.freeze(
    Object.fromEntries(
      HISTORY_KIND_CATEGORIES.flatMap((category) =>
        category.kinds.map((kind) => [kind, category.id] as const),
      ),
    ),
  );

/** True when `value` is a consolidated category id rather than a raw kind. */
export function isHistoryKindCategory(value: string): value is HistoryKindCategoryId {
  return HISTORY_KIND_CATEGORIES.some((category) => category.id === value);
}

/** Raw kinds belonging to a category id, or an empty list for unknown ids. */
export function historyKindsForCategory(categoryId: string): readonly string[] {
  return HISTORY_KIND_CATEGORIES.find((category) => category.id === categoryId)?.kinds ?? [];
}

export const HISTORY_SORT_OPTIONS: readonly {
  readonly value: HistorySort;
  readonly label: string;
}[] = [
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

/**
 * Consolidated primary type facet: one option per {@link HISTORY_KIND_CATEGORIES} category
 * that has at least one record in the current slice, with counts summed across the raw kinds
 * it rolls up. Preserves the declared category order so the control is stable across slices.
 */
export function buildHistoryKindCategoryFacetOptions(
  nodes: readonly { readonly kind: string }[],
): readonly HistoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const categoryId = HISTORY_KIND_TO_CATEGORY[node.kind];
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }
  const options = HISTORY_KIND_CATEGORIES.filter((category) => (counts.get(category.id) ?? 0) > 0).map(
    (category) => ({
      value: category.id,
      label: category.label,
      count: counts.get(category.id) ?? 0,
    }),
  );
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

export function buildHistoryEraFacetOptions(
  nodes: readonly { readonly eraBuckets: readonly string[] }[],
): readonly HistoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const bucket of node.eraBuckets) {
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  }
  const options = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, label: value, count }));
  return [{ value: 'all', label: 'All eras' }, ...options];
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
  // Consolidated category selection matches any of its member kinds; otherwise fall back to
  // an exact raw-kind match (advanced "all record types" disclosure).
  if (isHistoryKindCategory(filters.kind)) {
    const memberKinds = new Set(historyKindsForCategory(filters.kind));
    return items.filter((item) => memberKinds.has(item.kind));
  }
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

export function applyHistoryEraFilter<T extends { readonly eraBuckets: readonly string[] }>(
  items: readonly T[],
  era: string,
): readonly T[] {
  if (era === 'all') return items;
  const needle = era.trim().toLowerCase();
  return items.filter((item) => item.eraBuckets.some((bucket) => bucket.toLowerCase() === needle));
}

export function applyHistoryTopicFilter<T extends { readonly topicTags: readonly string[] }>(
  items: readonly T[],
  topic: string,
): readonly T[] {
  if (topic === 'all') return items;
  return items.filter((item) => item.topicTags.includes(topic));
}

export function applyHistoryConnectionsFilter<T extends { readonly connectionCount: number }>(
  items: readonly T[],
  connections: HistoryConnectionsFilter,
): readonly T[] {
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
  T extends {
    readonly displayName: string;
    readonly kind: string;
    readonly connectionCount: number;
  },
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
  return edges.filter((edge) => nodeIds.has(edge.fromEntityId) && nodeIds.has(edge.toEntityId));
}

/**
 * Pure view-model for the `/law` browse and detail pages. No Next.js runtime dependency.
 */
import type { LawStatus } from '@repo/domain/entity-status';
import type { LegalCatalogSource, LegalSnapshotDocument } from '../../lib/legal/public-source';

/** A `/law` chronology row, as `LawBrowseSections` renders it. */
export type LegalBrowseItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: string;
  readonly citation: string;
  readonly lawStatus: LawStatus;
  readonly topics: readonly string[];
  readonly hasExplainer: boolean;
  /** Plain-language opening line, so the row says what the law does. */
  readonly summary?: string;
  readonly effectiveYear?: number;
};

export type RawLawBrowseParams = {
  readonly q?: string;
  readonly kind?: string;
  readonly topic?: string;
  readonly status?: string;
  readonly sort?: string;
};

/** Canonical public browse address. */
export function lawBrowseHref(params: RawLawBrowseParams): string {
  const search = new URLSearchParams();
  for (const key of ['q', 'kind', 'topic', 'status'] as const) {
    const value = params[key]?.trim();
    if (value && value !== 'all') search.set(key, value);
  }
  if (params.sort && params.sort !== 'chronological') search.set('sort', params.sort);
  return search.size > 0 ? `/law?${search}` : '/law';
}

/**
 * The periods the chronology groups by. Conventional periodization of Black legal history, with
 * fixed year bounds (inclusive) so a law's group follows from its effective year alone.
 */
export type LawEra = {
  readonly id: string;
  readonly name: string;
  readonly from?: number;
  readonly to?: number;
};

export const LAW_ERAS: readonly LawEra[] = [
  { id: 'before-1865', name: 'Before 1865', to: 1864 },
  { id: 'reconstruction', name: 'Reconstruction', from: 1865, to: 1877 },
  { id: 'jim-crow', name: 'Jim Crow', from: 1878, to: 1953 },
  { id: 'civil-rights', name: 'Civil rights era', from: 1954, to: 1968 },
  { id: 'since-1969', name: 'Since 1969', from: 1969 },
];

/** The group for entries with no effective year, always last. */
export const LAW_UNDATED: LawEra = { id: 'undated', name: 'Year not recorded' };

export function lawEraFor(year: number | undefined): LawEra {
  if (year === undefined) return LAW_UNDATED;
  return (
    LAW_ERAS.find(
      (era) =>
        (era.from === undefined || year >= era.from) && (era.to === undefined || year <= era.to),
    ) ?? LAW_UNDATED
  );
}

/** One era of the chronology and the entries in it, in the current order. */
export type LawGroup = {
  readonly era: LawEra;
  readonly items: readonly LegalBrowseItem[];
};

export const LAW_SORTS = ['chronological', 'recent', 'title'] as const;
export type LawSort = (typeof LAW_SORTS)[number];

export const LAW_SORT_OPTIONS: readonly { readonly value: LawSort; readonly label: string }[] = [
  { value: 'chronological', label: 'Oldest first' },
  { value: 'recent', label: 'Newest first' },
  { value: 'title', label: 'A to Z' },
];

function isLawSort(value: string): value is LawSort {
  return (LAW_SORTS as readonly string[]).includes(value);
}

export type LawBrowseViewModel = {
  readonly q: string;
  readonly kind: string;
  readonly topic: string;
  readonly status: string;
  readonly sort: LawSort;
  readonly items: readonly LegalBrowseItem[];
  /**
   * The items by era, in the current order. Empty eras are absent. A title sort has no time
   * order to group by, so it yields no groups and the list renders flat.
   */
  readonly groups: readonly LawGroup[];
  readonly totalMatched: number;
  readonly totalAvailable: number;
  /** True when any facet or query narrows the catalog. */
  readonly isFiltered: boolean;
  /** Facet values across the whole catalog, with how many entries carry each. */
  readonly kindOptions: readonly LawFacetOption[];
  readonly topicOptions: readonly LawFacetOption[];
  readonly statusOptions: readonly LawFacetOption[];
  readonly sortOptions: readonly { readonly value: LawSort; readonly label: string }[];
};

export type LawFacetOption = { readonly value: string; readonly count: number };

/** One end of the detail page's session prev/next, in the browse page's own default order. */
export type LawNavTarget = {
  readonly slug: string;
  readonly title: string;
};

export type LawDetailViewModel =
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'ok';
      readonly snapshot: LegalSnapshotDocument;
      readonly explainer?: ReturnType<LegalCatalogSource['explainerFor']>;
      /** The law immediately before/after this one in the unfiltered chronological order —
       * the same order `/law` shows by default — or undefined at either end of the catalog. */
      readonly previous?: LawNavTarget;
      readonly next?: LawNavTarget;
    };

function knownOrAll(raw: string | undefined, options: readonly LawFacetOption[]): string {
  const trimmed = (raw ?? '').trim();
  return options.some((option) => option.value === trimmed) ? trimmed : 'all';
}

/**
 * First sentence of `whatItSays`, so a browse card tells you what the law does instead of
 * only what it is cited as. Abbreviations ("Pub. L.", "42 U.S.C. § 1983", "No. 20-1199")
 * make a naive split on "." wrong, so only break on a period that ends a word and is
 * followed by a capitalized next word.
 */
function firstSentence(text: string): string {
  const match = /^(.*?[a-z0-9)"'”])\.\s+(?=[A-Z"'“])/.exec(text);
  const candidate = match?.[1];
  if (candidate && candidate.length >= 60) return `${candidate}.`;
  return text;
}

/**
 * Summaries open by restating the law's name ("The Thirteenth Amendment, ratified December 6,
 * 1865, provides..."), which the row already prints above them. Start after it, so the line
 * opens on a fact instead.
 */
function withoutRestatedTitle(summary: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rest = summary.replace(new RegExp(`^(?:The\\s+)?${escaped},\\s+`, 'i'), '');
  if (rest === summary || rest.length === 0) return summary;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function snapshotToBrowseItem(
  snapshot: LegalSnapshotDocument,
  source: LegalCatalogSource,
): LegalBrowseItem {
  const explainer = source.explainerFor(snapshot.id);
  const summary = explainer?.whatItSays
    ? withoutRestatedTitle(firstSentence(explainer.whatItSays), snapshot.title)
    : undefined;
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    kind: snapshot.kind,
    citation: snapshot.citation.canonicalCitation,
    lawStatus: snapshot.lawStatus,
    topics: snapshot.topics,
    hasExplainer: explainer !== undefined,
    ...(summary ? { summary } : {}),
    ...(snapshot.effectiveYear ? { effectiveYear: snapshot.effectiveYear } : {}),
  };
}

/** Undated rows sort last in either direction rather than colliding at year zero. */
function compareByYear(a: LegalBrowseItem, b: LegalBrowseItem, newestFirst: boolean): number {
  if (a.effectiveYear === undefined && b.effectiveYear === undefined) return 0;
  if (a.effectiveYear === undefined) return 1;
  if (b.effectiveYear === undefined) return -1;
  if (a.effectiveYear === b.effectiveYear) return a.title.localeCompare(b.title);
  return newestFirst ? b.effectiveYear - a.effectiveYear : a.effectiveYear - b.effectiveYear;
}

function sortItems(items: LegalBrowseItem[], sort: LawSort): LegalBrowseItem[] {
  switch (sort) {
    case 'recent':
      return items.sort((a, b) => compareByYear(a, b, true));
    case 'title':
      return items.sort((a, b) => a.title.localeCompare(b.title));
    case 'chronological':
    default:
      return items.sort((a, b) => compareByYear(a, b, false));
  }
}

/** Values sorted by name, each with how many entries carry it. */
function facetOptions(values: readonly string[]): readonly LawFacetOption[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
}

function groupByEra(items: readonly LegalBrowseItem[]): LawGroup[] {
  const groups: { era: LawEra; items: LegalBrowseItem[] }[] = [];
  for (const item of items) {
    const era = lawEraFor(item.effectiveYear);
    const last = groups.at(-1);
    if (last?.era.id === era.id) last.items.push(item);
    else groups.push({ era, items: [item] });
  }
  return groups;
}

export function buildLawBrowseViewModel(
  raw: RawLawBrowseParams,
  source: LegalCatalogSource,
): LawBrowseViewModel {
  const allSnapshots = source.snapshots;
  const kindOptions = facetOptions(allSnapshots.map((s) => s.kind));
  const topicOptions = facetOptions(allSnapshots.flatMap((s) => [...s.topics]));
  const statusOptions = facetOptions(allSnapshots.map((s) => s.lawStatus));

  const q = (raw.q ?? '').trim().toLowerCase();
  // A value no entry carries (a typo, a retired enum) is dropped, never echoed back as a filter.
  const kind = knownOrAll(raw.kind, kindOptions);
  const topic = knownOrAll(raw.topic, topicOptions);
  const status = knownOrAll(raw.status, statusOptions);
  const rawSort = (raw.sort ?? '').trim();
  const sort: LawSort = isLawSort(rawSort) ? rawSort : 'chronological';

  const filtered = allSnapshots.filter((snapshot) => {
    if (kind !== 'all' && snapshot.kind !== kind) return false;
    if (topic !== 'all' && !snapshot.topics.includes(topic as never)) return false;
    if (status !== 'all' && snapshot.lawStatus !== status) return false;
    if (q) {
      const haystack =
        `${snapshot.title} ${snapshot.citation.canonicalCitation} ${snapshot.topics.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // shortcut: the whole catalog renders on one page (a few dozen entries); page it by era if it
  // ever grows past a few hundred.
  const items = sortItems(
    filtered.map((snapshot) => snapshotToBrowseItem(snapshot, source)),
    sort,
  );

  return {
    q: raw.q ?? '',
    kind,
    topic,
    status,
    sort,
    items,
    groups: sort === 'title' ? [] : groupByEra(items),
    totalMatched: filtered.length,
    totalAvailable: allSnapshots.length,
    isFiltered: q !== '' || kind !== 'all' || topic !== 'all' || status !== 'all',
    kindOptions,
    topicOptions,
    statusOptions,
    sortOptions: LAW_SORT_OPTIONS,
  };
}

export function buildLawDetailViewModel(
  slug: string,
  source: LegalCatalogSource,
): LawDetailViewModel {
  const snapshot = source.snapshots.find((row) => row.slug === slug);
  if (!snapshot) return { kind: 'not_found' };

  const explainer = source.explainerFor(snapshot.id);

  // Reuses the browse view's own unfiltered chronological order rather than re-deriving a
  // second comparator here, so a reader stepping prev/next off the detail page walks the exact
  // sequence `/law` shows by default.
  const order = sortItems(
    source.snapshots.map((snapshot) => snapshotToBrowseItem(snapshot, source)),
    'chronological',
  );
  const index = order.findIndex((item) => item.id === snapshot.id);
  const previous = index > 0 ? order[index - 1] : undefined;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;

  return {
    kind: 'ok',
    snapshot,
    ...(explainer ? { explainer } : {}),
    ...(previous ? { previous: { slug: previous.slug, title: previous.title } } : {}),
    ...(next ? { next: { slug: next.slug, title: next.title } } : {}),
  };
}

export function listLawStaticParams(
  source: LegalCatalogSource,
): readonly { readonly slug: string }[] {
  return source.snapshots.map((snapshot) => ({ slug: snapshot.slug }));
}

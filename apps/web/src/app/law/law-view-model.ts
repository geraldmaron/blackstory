/**
 * Pure view-model for the `/law` browse and detail pages. No Next.js runtime dependency.
 */
import type { LawStatus } from '@repo/domain/entity-status';
import { isLawStatus } from '../../components/legal/format';
import type { LegalCatalogSource, LegalSnapshotDocument } from '../../lib/legal/public-source';

/** A `/law` browse row, as `LawBrowseSections` renders it. */
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
  readonly page?: string;
};

/**
 * Browse ordering. Chronological is the default: law reads as a sequence, and sorting
 * by title put "42 U.S.C. § 1983" above Brown v. Board purely because of the digit.
 */
export const LAW_PAGE_SIZE = 24;

/** Canonical public browse address; a new filter starts at page one unless paging explicitly. */
export function lawBrowseHref(params: RawLawBrowseParams): string {
  const search = new URLSearchParams();
  for (const key of ['q', 'kind', 'topic', 'status'] as const) {
    const value = params[key]?.trim();
    if (value && value !== 'all') search.set(key, value);
  }
  if (params.sort && params.sort !== 'chronological') search.set('sort', params.sort);
  const page = Number(params.page);
  if (Number.isSafeInteger(page) && page > 1) search.set('page', String(Math.min(page, 1000)));
  return search.size > 0 ? `/law?${search}` : '/law';
}

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
  readonly totalMatched: number;
  readonly totalAvailable: number;
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  /** True when any facet or query narrows the catalog — drives the "showing N of M" copy. */
  readonly isFiltered: boolean;
  readonly kindOptions: readonly { readonly value: string; readonly label: string }[];
  readonly topicOptions: readonly { readonly value: string; readonly label: string }[];
  readonly sortOptions: readonly { readonly value: string; readonly label: string }[];
};

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

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
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

function snapshotToBrowseItem(
  snapshot: LegalSnapshotDocument,
  source: LegalCatalogSource,
): LegalBrowseItem {
  const explainer = source.explainerFor(snapshot.id);
  const summary = explainer?.whatItSays ? firstSentence(explainer.whatItSays) : undefined;
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

function buildFacetOptions(
  values: readonly string[],
  allLabel: string,
): readonly { value: string; label: string }[] {
  const unique = [...new Set(values)].sort();
  return [{ value: 'all', label: allLabel }, ...unique.map((value) => ({ value, label: value }))];
}

export function buildLawBrowseViewModel(
  raw: RawLawBrowseParams,
  source: LegalCatalogSource,
): LawBrowseViewModel {
  const q = (raw.q ?? '').trim().toLowerCase();
  const kind = cleanSelectParam(raw.kind);
  const topic = cleanSelectParam(raw.topic);
  const status = cleanSelectParam(raw.status);
  const rawSort = (raw.sort ?? '').trim();
  const sort: LawSort = isLawSort(rawSort) ? rawSort : 'chronological';

  const allSnapshots = source.snapshots;
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

  const ordered = sortItems(
    filtered.map((snapshot) => snapshotToBrowseItem(snapshot, source)),
    sort,
  );
  const pageCount = Math.max(1, Math.ceil(ordered.length / LAW_PAGE_SIZE));
  const requestedPage = Number(raw.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 1
      ? Math.min(requestedPage, pageCount)
      : 1;

  return {
    q: raw.q ?? '',
    kind,
    topic,
    status,
    sort,
    items: ordered.slice((page - 1) * LAW_PAGE_SIZE, page * LAW_PAGE_SIZE),
    page,
    pageCount,
    pageSize: LAW_PAGE_SIZE,
    totalMatched: filtered.length,
    totalAvailable: allSnapshots.length,
    isFiltered: q !== '' || kind !== 'all' || topic !== 'all' || status !== 'all',
    kindOptions: buildFacetOptions(
      allSnapshots.map((s) => s.kind),
      'All kinds',
    ),
    topicOptions: buildFacetOptions(
      allSnapshots.flatMap((s) => [...s.topics]),
      'All topics',
    ),
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

export { isLawStatus };

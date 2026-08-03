/**
 * Pure view-model for the `/law` browse and detail pages. No Next.js runtime dependency.
 */
import type { LegalBrowseItem } from '../../components/legal';
import { isLawStatus } from '../../components/legal/format';
import type { LegalCatalogSource, LegalSnapshotDocument } from '../../lib/legal/public-source';

export type RawLawBrowseParams = {
  readonly q?: string;
  readonly kind?: string;
  readonly topic?: string;
  readonly status?: string;
  readonly sort?: string;
};

/**
 * Browse ordering. Chronological is the default: law reads as a sequence, and sorting
 * by title put "42 U.S.C. § 1983" above Brown v. Board purely because of the digit.
 */
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
  /** True when any facet or query narrows the catalog — drives the "showing N of M" copy. */
  readonly isFiltered: boolean;
  readonly kindOptions: readonly { readonly value: string; readonly label: string }[];
  readonly topicOptions: readonly { readonly value: string; readonly label: string }[];
  readonly sortOptions: readonly { readonly value: string; readonly label: string }[];
};

export type LawDetailViewModel =
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'ok';
      readonly snapshot: LegalSnapshotDocument;
      readonly explainer?: ReturnType<LegalCatalogSource['explainerFor']>;
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

  return {
    q: raw.q ?? '',
    kind,
    topic,
    status,
    sort,
    items: sortItems(
      filtered.map((snapshot) => snapshotToBrowseItem(snapshot, source)),
      sort,
    ),
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

  return {
    kind: 'ok',
    snapshot,
    ...(explainer ? { explainer } : {}),
  };
}

export function listLawStaticParams(
  source: LegalCatalogSource,
): readonly { readonly slug: string }[] {
  return source.snapshots.map((snapshot) => ({ slug: snapshot.slug }));
}

export { isLawStatus };

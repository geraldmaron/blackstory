/**
 * Pure view-model for the `/law` browse and detail pages. No Next.js runtime dependency.
 */
import type { LegalBrowseItem } from '../../components/legal';
import { isLawStatus } from '../../components/legal/format';
import type {
  LegalCatalogSource,
  LegalSnapshotDocument,
} from '../../lib/legal/public-source';

export type RawLawBrowseParams = {
  readonly q?: string;
  readonly kind?: string;
  readonly topic?: string;
  readonly status?: string;
};

export type LawBrowseViewModel = {
  readonly q: string;
  readonly kind: string;
  readonly topic: string;
  readonly status: string;
  readonly items: readonly LegalBrowseItem[];
  readonly totalMatched: number;
  readonly kindOptions: readonly { readonly value: string; readonly label: string }[];
  readonly topicOptions: readonly { readonly value: string; readonly label: string }[];
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

function snapshotToBrowseItem(
  snapshot: LegalSnapshotDocument,
  source: LegalCatalogSource,
): LegalBrowseItem {
  const explainer = source.explainerFor(snapshot.id);
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    kind: snapshot.kind,
    citation: snapshot.citation.canonicalCitation,
    lawStatus: snapshot.lawStatus,
    topics: snapshot.topics,
    hasExplainer: explainer !== undefined,
  };
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
    items: filtered.map((snapshot) => snapshotToBrowseItem(snapshot, source)),
    totalMatched: filtered.length,
    kindOptions: buildFacetOptions(
      allSnapshots.map((s) => s.kind),
      'All kinds',
    ),
    topicOptions: buildFacetOptions(
      allSnapshots.flatMap((s) => [...s.topics]),
      'All topics',
    ),
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

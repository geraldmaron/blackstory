/**
 * Pure view-model for the `/legal` browse and detail pages. No Next.js runtime dependency.
 */
import { slugifyFactStatement } from '@blap/domain';
import type { LegalBrowseItem } from '../../components/legal';
import { isLawStatus } from '../../components/legal/format';
import {
  getLegalCatalogEntry,
  getLegalFact,
  getLegalSnapshotBySlug,
  listLegalSnapshots,
  type SEED_LEGAL_SNAPSHOTS,
} from '../../data/legal-seed';

export type RawLegalBrowseParams = {
  readonly q?: string;
  readonly kind?: string;
  readonly topic?: string;
  readonly status?: string;
};

export type LegalBrowseViewModel = {
  readonly q: string;
  readonly kind: string;
  readonly topic: string;
  readonly status: string;
  readonly items: readonly LegalBrowseItem[];
  readonly totalMatched: number;
  readonly kindOptions: readonly { readonly value: string; readonly label: string }[];
  readonly topicOptions: readonly { readonly value: string; readonly label: string }[];
};

export type LegalDetailViewModel =
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'ok';
      readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
      readonly explainer?: ReturnType<typeof getLegalCatalogEntry> extends infer T ? NonNullable<T>['explainer'] : never;
      readonly factHref?: string;
    };

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

function snapshotToBrowseItem(
  snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number],
): LegalBrowseItem {
  const catalog = getLegalCatalogEntry(snapshot.id);
  const fact = snapshot.factId ? getLegalFact(snapshot.factId) : undefined;
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    kind: snapshot.kind,
    citation: snapshot.citation.canonicalCitation,
    lawStatus: snapshot.lawStatus,
    topics: snapshot.topics,
    hasExplainer: catalog !== undefined,
    ...(fact ? { factHref: `/facts/${fact.id}/${slugifyFactStatement(fact.shortStatement)}` } : {}),
  };
}

function buildFacetOptions(values: readonly string[], allLabel: string): readonly { value: string; label: string }[] {
  const unique = [...new Set(values)].sort();
  return [{ value: 'all', label: allLabel }, ...unique.map((value) => ({ value, label: value }))];
}

export function buildLegalBrowseViewModel(raw: RawLegalBrowseParams): LegalBrowseViewModel {
  const q = (raw.q ?? '').trim().toLowerCase();
  const kind = cleanSelectParam(raw.kind);
  const topic = cleanSelectParam(raw.topic);
  const status = cleanSelectParam(raw.status);

  const allSnapshots = listLegalSnapshots();
  const filtered = allSnapshots.filter((snapshot) => {
    if (kind !== 'all' && snapshot.kind !== kind) return false;
    if (topic !== 'all' && !snapshot.topics.includes(topic as never)) return false;
    if (status !== 'all' && snapshot.lawStatus !== status) return false;
    if (q) {
      const haystack = `${snapshot.title} ${snapshot.citation.canonicalCitation} ${snapshot.topics.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return {
    q: raw.q ?? '',
    kind,
    topic,
    status,
    items: filtered.map(snapshotToBrowseItem),
    totalMatched: filtered.length,
    kindOptions: buildFacetOptions(allSnapshots.map((s) => s.kind), 'All kinds'),
    topicOptions: buildFacetOptions(allSnapshots.flatMap((s) => [...s.topics]), 'All topics'),
  };
}

export function buildLegalDetailViewModel(slug: string): LegalDetailViewModel {
  const snapshot = getLegalSnapshotBySlug(slug);
  if (!snapshot) return { kind: 'not_found' };

  const catalog = getLegalCatalogEntry(snapshot.id);
  const fact = snapshot.factId ? getLegalFact(snapshot.factId) : undefined;

  return {
    kind: 'ok',
    snapshot,
    ...(catalog ? { explainer: catalog.explainer } : {}),
    ...(fact ? { factHref: `/facts/${fact.id}/${slugifyFactStatement(fact.shortStatement)}` } : {}),
  };
}

export function listLegalStaticParams(): readonly { readonly slug: string }[] {
  return listLegalSnapshots().map((snapshot) => ({ slug: snapshot.slug }));
}

export { isLawStatus };

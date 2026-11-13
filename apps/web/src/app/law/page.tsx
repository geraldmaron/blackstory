/**
 * `/law`: the statutes, amendments and court decisions as a chronology.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { PageHeader } from '@repo/ui';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { parentCrumb, Room } from '../../components/room';
import { buildLawBrowseViewModel, lawBrowseHref, type RawLawBrowseParams } from './law-view-model';
import { LawBrowseSections } from './LawBrowseSections';
import '../reading-room.css';
import './law.css';

void React;

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export async function generateMetadata({ searchParams }: LawPageProps): Promise<Metadata> {
  const view = buildLawBrowseViewModel(await searchParams, await loadLegalCatalog());
  return {
    ...buildStaticPageMetadata({
      path: lawBrowseHref(view),
      title: 'Law',
      description:
        'Plain-language statutes, regulations, and court decisions that shaped what could be built, owned, attended and voted for.',
    }),
    ...(view.q.trim() || view.sort !== 'chronological'
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

/** "12 laws, 1865 to 2023": the one count on the page, and the span the chronology covers. */
function dek(view: ReturnType<typeof buildLawBrowseViewModel>): string | undefined {
  if (view.totalAvailable === 0) return undefined;
  const count = view.isFiltered
    ? `${view.totalMatched.toLocaleString('en-US')} of ${view.totalAvailable.toLocaleString('en-US')} laws`
    : `${view.totalAvailable.toLocaleString('en-US')} ${view.totalAvailable === 1 ? 'law' : 'laws'}`;
  const years = view.items.flatMap((item) => (item.effectiveYear ? [item.effectiveYear] : []));
  if (years.length < 2) return count;
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? `${count}, ${first}` : `${count}, ${first} to ${last}`;
}

export default async function LawPage({ searchParams }: LawPageProps) {
  const source = await loadLegalCatalog();
  const view = buildLawBrowseViewModel(await searchParams, source);

  return (
    <Room width="wide" className="ds-law">
      <PageHeader crumb={parentCrumb('/law')} linkAs={Link} title="Law" dek={dek(view)} />
      <LawBrowseSections view={view} catalog={source.snapshots} />
    </Room>
  );
}

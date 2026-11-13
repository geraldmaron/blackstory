/**
 * Public law reference browse surface at `/law`.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel, lawBrowseHref, type RawLawBrowseParams } from './law-view-model';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { LawBrowseSections } from './LawBrowseSections';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import '../reading-room.css';

void React;

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export async function generateMetadata({ searchParams }: LawPageProps): Promise<Metadata> {
  const view = buildLawBrowseViewModel(await searchParams, await loadLegalCatalog());
  return {
    ...buildStaticPageMetadata({
      path: lawBrowseHref({ ...view, page: String(view.page) }),
      title: 'Law',
      description:
        'Plain-language statutes, regulations, and court decisions that shaped what could be built, owned, attended and voted for.',
    }),
    ...(view.q.trim() || view.sort !== 'chronological'
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export default async function LawPage({ searchParams }: LawPageProps) {
  const params = await searchParams;
  const source = await loadLegalCatalog();
  const catalog = source.snapshots;
  const view = buildLawBrowseViewModel(params, source);

  return (
    <Room width="wide">
      <PageHeader
        crumb={parentCrumb('/law')}
        linkAs={Link}
        title="What the law actually said"
        dek={LAW_EDITION_BROWSE_LEDE}
      />

      <LawBrowseSections view={view} catalog={catalog} />
    </Room>
  );
}

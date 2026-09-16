/**
 * Law catalog browse tools at `/law/browse`. The how-it-works Law section is the default
 * visitor journey; this route keeps filters, search, and the full index.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { WalkOffRamp } from '../../walk-off-ramp';
import { LAW_EDITION_BROWSE_LEDE } from '../law-copy';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from '../law-view-model';
import { loadLegalCatalog } from '../../../lib/legal/public-source';
import { LawBrowseSections } from '../LawBrowseSections';
import { humanizeLegalKind } from '../../../components/legal';
import { DocumentColophon, ReadingEntry, Room } from '../../../components/room';
import '../../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/law/browse',
  title: 'Browse law',
  description:
    'Search and filter landmark civil-rights statutes, regulations, and court decisions.',
});

type LawBrowsePageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export default async function LawBrowsePage({ searchParams }: LawBrowsePageProps) {
  const params = await searchParams;
  const source = await loadLegalCatalog();
  const catalog = source.snapshots;
  const view = buildLawBrowseViewModel(params, source);

  const kindCounts = new Map<string, number>();
  for (const snapshot of catalog) {
    kindCounts.set(snapshot.kind, (kindCounts.get(snapshot.kind) ?? 0) + 1);
  }
  const kindMeta = [...kindCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(
      ([kind, count]) =>
        `${count} ${humanizeLegalKind(kind).toLowerCase()}${count === 1 ? '' : 's'}`,
    );

  return (
    <Room>
      <ReadingEntry
        pathname="/law/browse"
        title={
          <>
            Browse civil rights <em>law</em>
          </>
        }
        lede={LAW_EDITION_BROWSE_LEDE}
        showCrumb={false}
      />
      <DocumentColophon
        facts={[`${catalog.length.toLocaleString('en-US')} law entries`, ...kindMeta]}
      />

      <LawBrowseSections view={view} catalog={catalog} />

      <WalkOffRamp>
        This catalog is jurisdictional. It does not invent a documented join to a record.
      </WalkOffRamp>
    </Room>
  );
}

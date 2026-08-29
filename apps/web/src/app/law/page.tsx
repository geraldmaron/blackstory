/**
 * Public law reference browse surface at `/law`.
 *
 * v9 room kit edition with shared browse/filter surface. Preserves GET
 * browse URL contract (`q`, `kind`, `topic`) and auto-submit facet selects.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { WalkOffRamp } from '../walk-off-ramp';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from './law-view-model';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { LawBrowseSections } from './LawBrowseSections';
import { humanizeLegalKind } from '../../components/legal';
import { Room, RoomHeader } from '../../components/room';
import '../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/law',
  title: 'Law',
  description:
    'Plain-language access to landmark civil-rights statutes, regulations, and court decisions.',
});

type LawPageProps = {
  readonly searchParams: Promise<RawLawBrowseParams>;
};

export default async function LawBrowsePage({ searchParams }: LawPageProps) {
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
      <RoomHeader
        pathname="/law"
        kicker="Reference"
        title={
          <>
            Civil rights <em>law</em>
          </>
        }
        lede={
          <>
            {LAW_EDITION_BROWSE_LEDE} This catalogue holds the statutes, regulations, constitutional
            amendments and landmark decisions themselves. It is linked to a place only by
            jurisdiction and era, never by a documented evidentiary join.
          </>
        }
        meta={[`${catalog.length.toLocaleString('en-US')} law entries`, ...kindMeta]}
      />

      <LawBrowseSections view={view} catalog={catalog} />

      <WalkOffRamp>
        This catalogue is jurisdictional. It does not invent a documented join to a record.
      </WalkOffRamp>
    </Room>
  );
}

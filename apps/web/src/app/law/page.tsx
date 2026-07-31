/**
 * Public law reference browse surface at `/law`.
 *
 * v9 room kit edition with shared browse/filter surface. Preserves GET
 * browse URL contract (`q`, `kind`, `topic`) and auto-submit facet selects.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';
import { buildLawBrowseViewModel, type RawLawBrowseParams } from './law-view-model';
import { loadLegalCatalog } from '../../lib/legal/public-source';
import { LawBrowseSections } from './LawBrowseSections';
import { Room, RoomHeader, OffRamp } from '../../components/room';
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
  const view = buildLawBrowseViewModel(params, await loadLegalCatalog());

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
        lede={LAW_EDITION_BROWSE_LEDE}
      />

      <LawBrowseSections view={view} />

      <OffRamp
        title={
          <>
            Or go straight to the <em>records</em>
          </>
        }
        actions={[
          { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
          { label: 'Search the archive', href: '/records' },
        ]}
      >
        Press <kbd className="ds-kbd">⌘</kbd>
        <kbd className="ds-kbd">K</kbd> to search laws and records from anywhere.
      </OffRamp>
    </Room>
  );
}

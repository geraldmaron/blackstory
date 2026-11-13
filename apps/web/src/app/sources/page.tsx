/**
 * `/sources`: the public source library. Every publisher the released catalog cites, with how
 * many records cite it, read from the same lineage keys the grade rule counts.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room } from '../../components/room';
import { loadSourceLibrary } from './load-source-library';
import { SourcesSections } from './SourcesSections';
import '../reading-room.css';
import '../../components/trust/trust.css';
import './sources.css';

void React;

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/sources',
  title: 'Source library',
  description:
    'Every publisher BlackStory cites, with how many published records cite each one, and how a URL becomes a citation on a record.',
});

export default async function SourcesPage() {
  const library = await loadSourceLibrary();
  return (
    <Room width="read">
      <SourcesSections library={library} />
    </Room>
  );
}

/**
 * `/sources` — the public source library: publisher kinds, the citation chain, and where
 * sources already appear on the site. Profiles and live counts stay on the operator desk.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room } from '../../components/room';
import { SourcesSections } from './SourcesSections';
import '../reading-room.css';

void React;

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/sources',
  title: 'Source library',
  description:
    'The kinds of publishers BlackStory cites, how a URL becomes a citation on a record, and where sources already appear on the public site.',
});

export default function SourcesPage() {
  return (
    <Room>
      <SourcesSections />
    </Room>
  );
}

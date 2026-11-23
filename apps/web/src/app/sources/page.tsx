/**
 * `/sources`: the public source library. Every publisher the released catalog cites, with how
 * many records cite it, read from the same lineage keys the grade rule counts.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import { TrustMast, TrustSheet } from '../../components/trust';
import { loadSourceLibrary } from './load-source-library';
import { SourcesSections, sourcesDek } from './SourcesSections';
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
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast
          numeral={
            library === undefined
              ? undefined
              : {
                  value: library.rows.length.toLocaleString('en-US'),
                  label: 'publishers the archive cites',
                  decorative: true,
                }
          }
        >
          <PageHeader
            display
            crumb={parentCrumb('/sources')}
            linkAs={Link}
            title="Where the evidence comes from"
            dek={sourcesDek(library)}
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <SourcesSections library={library} />
      </TrustSheet>
    </Room>
  );
}

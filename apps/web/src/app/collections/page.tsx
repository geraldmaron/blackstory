/**
 * `/collections`, the hub for the archive's collections: bounded sets of like things a reader
 * browses by their own key (term number, year, decade, title, name). One full-bleed copper block
 * holds them as numbered ruled rows, each with its name set large and one line of purpose.
 *
 * Rows and copy derive from the destination registry's `read` group, so no collection can be
 * hand-linked or go missing. The trust pages and forms Rooms used to list hang off About.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { Block, DisplayNumeral, PageHeader } from '@repo/ui';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { cardTitleFor, destinationsInGroup } from '../../lib/nav/destination-registry';
import { Room } from '../../components/room';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import { BandArt } from '../../components/atmosphere/BandArt';
import '../reading-room.css';
import './collections.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/collections',
  title: 'Collections',
  description:
    'Sets of like things, each read in its own order: every president on the record, the laws and rulings, national data series, lives decade by decade, banned books, and the memorial wall.',
});

function ArrowGlyph() {
  return (
    <svg className="ds-collections__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h9.5m0 0L8.5 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CollectionsPage() {
  const collections = destinationsInGroup('read');
  return (
    <Room width="wide" className="ds-collections">
      <PageHeader
        display
        className="ds-collections__head"
        title="Collections"
        dek={`${collections.length} sets of like things, each read in its own order.`}
        actions={
          <DisplayNumeral decorative className="ds-collections__count">
            {collections.length}
          </DisplayNumeral>
        }
      />

      <Block tone="copper" className="ds-collections__group" aria-label="Collections">
        <BandArt motifs={['contours']} />
        <div className="ds-wrap">
          <ol className="ds-collections__list">
            {collections.map((destination, index) => (
              <li key={destination.path}>
                <Link className="ds-collections__row" href={destination.path}>
                  <DisplayNumeral decorative className="ds-collections__num">
                    {String(index + 1).padStart(2, '0')}
                  </DisplayNumeral>
                  <span className="ds-collections__name ds-destination-label">
                    <DestinationIcon
                      id={destination.icon}
                      size="md"
                      className="ds-collections__icon"
                    />
                    {cardTitleFor(destination)}
                  </span>
                  {destination.description ? (
                    <span className="ds-collections__purpose">{destination.description}</span>
                  ) : null}
                  <ArrowGlyph />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </Block>
    </Room>
  );
}

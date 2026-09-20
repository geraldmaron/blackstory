/**
 * `/about` — what this is, who made it, and how to take part.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { ReadingEntry, Room } from '../../components/room';
import { ABOUT_LEDE } from './about-copy';
import { AboutSections } from './AboutSections';
import '../reading-room.css';
import './about-page.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/about',
  title: 'About',
  description:
    'BlackStory is a place-connected Black history archive, built by one person so documented history stays findable, and kept open so other people can add to it.',
});

export default function AboutPage() {
  return (
    <Room ledger>
      <ReadingEntry
        pathname="/about"
        title={
          <>
            Doing my part, and making room for <em>yours</em>.
          </>
        }
        lede={ABOUT_LEDE}
      />
      <AboutSections />
    </Room>
  );
}

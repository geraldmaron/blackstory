/**
 * Methodology v6 edition page: transparency and trust surface as a Surface card
 * stack on shared edition atmosphere. JSON-LD preserved; copy accurate.
 */

import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { MethodologySections } from './MethodologySections';
import { Room } from '../../components/room';
import '../reading-room.css';
// Retained for the section-level styling MethodologySections still carries; the page chrome it
// used to provide is drawn by the room kit now.
import './methodology-edition.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/methodology',
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies, verifies sources, protects living people, handles corrections, and publishes confidence you can check yourself. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
});

export default function MethodologyPage() {
  return (
    <Room>
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      {/* MethodologySections renders its own heading and lede, so the room takes no RoomHeader:
          a second title would put two h1s on the page the archive uses to prove its own rigour. */}
      <MethodologySections />
    </Room>
  );
}

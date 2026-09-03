/**
 * `/methodology` — the room kit build. See `MethodologySections.tsx` for why it renders no grade
 * mark or citation string of its own: both come from the live `Confidence` and `Citation`
 * components record pages use.
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

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/methodology',
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies as a record, checks it against independent sources, grades how sure the evidence is, keeps the addresses of living people off the map, and corrects itself in the open.',
});

/**
 * Off-ramp goes back to the place. This receipt page stays static.
 */
export default function MethodologyPage() {
  return (
    <Room>
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      <MethodologySections />
    </Room>
  );
}

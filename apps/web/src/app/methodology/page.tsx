/**
 * `/methodology` — how a record gets in. See `MethodologySections.tsx` for grade and citation
 * components drawn from the live record-page kit.
 */
import type { Metadata } from 'next';
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
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

export default function MethodologyPage() {
  return (
    <Room ledger>
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      <MethodologySections />
    </Room>
  );
}

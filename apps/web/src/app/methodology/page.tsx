/**
 * `/methodology`: how a record gets in, and the one place the evidence grades are defined.
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
import '../../components/trust/trust.css';
import './methodology.css';

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/methodology',
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies as a record, checks it against independent sources, grades how sure the evidence is, keeps the addresses of living people off the map, and corrects itself in the open.',
});

export default function MethodologyPage() {
  return (
    <Room width="read">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      <MethodologySections />
    </Room>
  );
}

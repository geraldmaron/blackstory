/**
 * Methodology and transparency page — full editorial trust surface with JSON-LD.
 */
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { MethodologySections } from './MethodologySections';

export const metadata = {
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies, verifies sources, protects living people, handles corrections, and publishes confidence you can check yourself. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
};

export default function MethodologyPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      <p className="ds-page__eyebrow">Transparency</p>
      <h1 className="ds-page__title">How we work</h1>
      <p className="ds-page__lede">
        History shouldn&apos;t and can&apos;t be erased. It shouldn&apos;t be hard to find. It
        should be accessible because it is about you. This page is the full receipt: definitions,
        source rules, confidence grades, map dignity limits, and correction policy — so you can
        verify a record yourself.
      </p>
      <MethodologySections />
    </main>
  );
}

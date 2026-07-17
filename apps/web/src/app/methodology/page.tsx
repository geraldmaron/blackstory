/**
 * Methodology and transparency page full editorial trust surface with JSON-LD.
 */
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index.js';
import { TRUST_PATHS } from '../../lib/trust/site-identity.js';
import { MethodologySections } from './MethodologySections.js';

export const metadata = {
  title: 'Methodology',
  description:
    'How Black Book decides what qualifies, verifies sources, handles corrections, and publishes transparency indicators.',
};

export default function MethodologyPage() {
  return (
    <main className="bb-container bb-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.methodology} pageTitle="Methodology" />
      <p className="bb-page__eyebrow">Transparency</p>
      <h1 className="bb-page__title">How we work</h1>
      <p className="bb-page__lede">
        Radical transparency experienced as rigor and reader empowerment — every definition, source
        rule, and correction policy you need to verify a record yourself.
      </p>
      <MethodologySections />
    </main>
  );
}

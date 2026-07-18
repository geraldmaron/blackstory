/**
 * Methodology and transparency page full editorial trust surface with JSON-LD.
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
    'How Blap decides what qualifies, verifies sources, handles corrections, and publishes transparency indicators.',
};

export default function MethodologyPage() {
  return (
    <main className="bp-container bp-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.methodology} pageTitle="Methodology" />
      <p className="bp-page__eyebrow">Transparency</p>
      <h1 className="bp-page__title">How we work</h1>
      <p className="bp-page__lede">
        Radical transparency experienced as rigor and reader empowerment — every definition, source
        rule, and correction policy you need to verify a record yourself.
      </p>
      <MethodologySections />
    </main>
  );
}

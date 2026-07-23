/**
 * Methodology v6 edition page: transparency and trust surface as a Surface card
 * stack on shared edition atmosphere. JSON-LD preserved; copy accurate.
 */

import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { EditionAtmosphereMosaic } from '../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { MethodologySections } from './MethodologySections';
import {
  METHODOLOGY_EDITION_MOSAIC_SEED,
  methodologyEditionRootClassName,
  methodologyEditionStackClassName,
} from './methodology-panel-chrome';
import './methodology-edition.css';

export const metadata = {
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies, verifies sources, protects living people, handles corrections, and publishes confidence you can check yourself. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
};

export default function MethodologyPage() {
  return (
    <div className={methodologyEditionRootClassName()} data-methodology-edition="v6">
      <EditionAtmosphereMosaic seedKey={METHODOLOGY_EDITION_MOSAIC_SEED} count={16} />
      <main className="ds-container ds-page" id="main">
        <TrustSiteJsonLdScript />
        <PublishingPrinciplesJsonLdScript
          pagePath={TRUST_PATHS.methodology}
          pageTitle="Methodology"
        />
        <div className={methodologyEditionStackClassName()}>
          <MethodologySections />
        </div>
      </main>
    </div>
  );
}

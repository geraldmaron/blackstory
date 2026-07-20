/**
 * Public errata log reverse-chronological corrections policy and change history with
 * four-way taxonomy. Companion feeds at /errata/feed.json and /errata/feed.xml.
 */
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { listErrataEntries } from '../../lib/trust/errata-seed';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { ErrataSections } from './ErrataSections';

export const metadata = {
  title: 'Errata & corrections policy',
  description:
    'Reverse-chronological log of corrections, clarifications, updates, and editor notes — fully, quickly, and without defensiveness.',
};

export default function ErrataPage() {
  const entries = listErrataEntries();

  return (
    <main className="ds-container ds-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.errata} pageTitle="Errata" />
      <p className="ds-page__eyebrow">Corrections</p>
      <h1 className="ds-page__title">Errata log</h1>
      <p className="ds-page__lede">
        Errors are fixed fully, quickly, and ungrudgingly. Every change is timestamped, categorized,
        and preserved — nothing is silently edited.
      </p>
      <ErrataSections entries={entries} />
    </main>
  );
}

/**
 * Public errata log reverse-chronological corrections policy and change history with
 * four-way taxonomy. Companion feeds at /errata/feed.json and /errata/feed.xml.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { listErrataEntries } from '../../lib/trust/errata-seed';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { ErrataSections } from './ErrataSections';
import { Room, RoomHeader } from '../../components/room';
import '../reading-room.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/errata',
  title: 'Errata & corrections policy',
  description:
    'Reverse-chronological log of corrections, clarifications, updates, and editor notes — fully, quickly, and without defensiveness.',
});

export default function ErrataPage() {
  const entries = listErrataEntries();

  return (
    <Room>
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.errata} pageTitle="Errata" />
      <RoomHeader
        pathname="/errata"
        kicker="Corrections"
        title="Errata log"
        lede="Errors are fixed fully, quickly, and ungrudgingly. Every change is timestamped, categorized, and preserved — nothing is silently edited."
      />
      <ErrataSections entries={entries} />
    </Room>
  );
}

/**
 * Public errata log a plain, reverse-chronological corrections list. Companion feeds at
 * /errata/feed.json and /errata/feed.xml, built from the same entry list as this page.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §4.2 "/errata". The header carries the
 * two feed links as mono chips; the body is a hairline list, never a set of disclosures.
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
import { WalkOffRamp } from '../walk-off-ramp';
import '../reading-room.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/errata',
  title: 'Errata',
  description:
    'Reverse-chronological log of corrections, clarifications, updates, and editor notes. Fixed fully, quickly, and without defensiveness.',
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
        lede="Errors are fixed fully, quickly, and ungrudgingly. Every change is timestamped, categorized, and preserved. Nothing is silently edited."
      />
      <p className="ds-errata__feedbar" aria-label="Subscribe to the errata log">
        <a className="ds-room-chip" href="/errata/feed.json">
          JSON Feed
        </a>
        <a className="ds-room-chip" href="/errata/feed.xml">
          RSS
        </a>
      </p>

      <ErrataSections entries={entries} />

      <WalkOffRamp
        title="Mistakes, published"
        extra={[
          { label: 'Request a correction', href: '/corrections' },
          { label: 'How we correct the record', href: '/methodology' },
        ]}
      >
        Every change documented here stays readable.
      </WalkOffRamp>
    </Room>
  );
}

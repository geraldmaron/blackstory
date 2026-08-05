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
import { getPublicSearchIndex } from '../../lib/public-data/source';
import { MethodologySections } from './MethodologySections';
import { Room } from '../../components/room';
import '../reading-room.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/methodology',
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies, verifies sources, protects living people, handles corrections, and publishes confidence you can check yourself. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
});

/**
 * "See it applied" links to a currently published record. Live Postgres reads are only mounted
 * at runtime (see `apps/web/src/app/entity/[id]/page.tsx`'s note on the same constraint), so this
 * is best effort: when the catalogue cannot be reached, `MethodologySections` falls back to
 * `/records`, which is itself always live.
 */
async function resolveExampleRecordHref(): Promise<string | undefined> {
  try {
    const { data } = await getPublicSearchIndex();
    const first = data[0];
    return first ? `/entity/${first.id}` : undefined;
  } catch {
    return undefined;
  }
}

export default async function MethodologyPage() {
  const exampleRecordHref = await resolveExampleRecordHref();

  return (
    <Room>
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      <MethodologySections {...(exampleRecordHref ? { exampleRecordHref } : {})} />
    </Room>
  );
}

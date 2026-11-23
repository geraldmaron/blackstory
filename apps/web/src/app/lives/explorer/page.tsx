/** `/lives/explorer`: complete decade × area utility, retained as an evidence appendix. */
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { LIVES_NATIONAL, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../../components/room';
import { TrustMast, TrustSheet } from '../../../components/trust';
import { livesDecadeNumeral } from '../../../components/lives/lives-mast';
import { emptyLivesAreaBundle, loadLivesAreaView } from '../../../lib/lives/lives-source';
import { parseLivesAreaSlug, type RawLivesSearchParams } from '../../../lib/lives/lives-url-state';
import { LivesSourceNotice } from '../../../components/lives/LivesSourceNotice';
import { LivesTimeline } from '../../../components/lives/LivesTimeline';
import { LivesTimelineStatic } from '../../../components/lives/LivesTimelineStatic';
import '../../reading-room.css';
import '../lives.css';

void React;

const DESCRIPTION =
  'Evidence appendix for published counts by decade, region and census definition, with coverage notes and source links.';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/lives/explorer',
  title: 'Lives evidence appendix',
  description: DESCRIPTION,
});

export default async function LivesExplorerPage({
  searchParams,
}: {
  readonly searchParams: Promise<RawLivesSearchParams>;
}) {
  const raw = await searchParams;
  const areaSlug = parseLivesAreaSlug(raw);
  const area = livesAreaBySlug(areaSlug) ?? LIVES_NATIONAL;
  const loaded = await loadLivesAreaView(area.slug);
  const bundle = loaded?.bundle ?? emptyLivesAreaBundle(area);

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast numeral={livesDecadeNumeral(bundle)}>
          <PageHeader
            display
            crumb={parentCrumb('/lives/explorer')}
            linkAs={Link}
            title="Evidence appendix"
            dek="Every decade, region, definition and coverage note behind Lives, with the cited tables."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <LivesSourceNotice
          source={loaded?.source ?? 'unreadable'}
          areaName={bundle.areaName}
          retryHref={`/lives/explorer?area=${encodeURIComponent(area.slug)}`}
        />

        <Suspense fallback={<LivesTimelineStatic bundle={bundle} areaSlug={area.slug} />}>
          <LivesTimeline bundle={bundle} areaSlug={area.slug} />
        </Suspense>
      </TrustSheet>
    </Room>
  );
}

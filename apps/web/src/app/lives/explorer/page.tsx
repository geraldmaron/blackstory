/** `/lives/explorer`: complete decade × area utility, retained as an evidence appendix. */
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { LIVES_NATIONAL, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { DocumentColophon, ReadingEntry, Room } from '../../../components/room';
import { WalkOffRamp } from '../../walk-off-ramp';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../../lib/lives/lives-source';
import { parseLivesAreaSlug, type RawLivesSearchParams } from '../../../lib/lives/lives-url-state';
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
  const loaded = await loadLivesAreaBundle(area.slug);
  const bundle = loaded ?? emptyLivesAreaBundle(area);

  return (
    <Room>
      <ReadingEntry
        pathname="/lives/explorer"
        title="Evidence appendix"
        lede="Inspect every available decade, region, definition, coverage note, and cited table behind Lives."
        showCrumb={false}
      />
      <DocumentColophon facts={[`Area · ${bundle.areaName}`, 'Full utility · 1870s to 2020s']} />

      <p className="lives-explorer__return">
        This is the research view. For the guided experience, <a href="/lives">return to Lives</a>.
      </p>

      <Suspense fallback={<LivesTimelineStatic bundle={bundle} areaSlug={area.slug} />}>
        <LivesTimeline bundle={bundle} areaSlug={area.slug} />
      </Suspense>

      <WalkOffRamp>
        Method on <a href="/methodology#lives-across-decades">Methodology</a>. Guided experience on{' '}
        <a href="/lives">Lives</a>.
      </WalkOffRamp>
    </Room>
  );
}

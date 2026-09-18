/**
 * `/lives`: immersive Lives Across the Decades room. Race × region × decade × unit changes a
 * hand-drawn street bound to published counts, with world beats opening the archive beside it.
 * `/lives/[region]` still resolves via `?area=`. Data Act II remains a compact entry that links here.
 */
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { LIVES_NATIONAL, LIVES_UNIT_KICKERS, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DocumentColophon, ReadingEntry, Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../lib/lives/lives-source';
import {
  parseLivesAreaSlug,
  parseLivesSearchParams,
  type RawLivesSearchParams,
} from '../../lib/lives/lives-url-state';
import { LivesTimeline } from '../../components/lives/LivesTimeline';
import { LivesTimelineStatic } from '../../components/lives/LivesTimelineStatic';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import '../reading-room.css';
import './lives.css';

void React;

const DESCRIPTION =
  'How Black, white and Hispanic Americans were spread across class, decade by decade from the 1870s, what their lives measured, which laws were in force, and what the census could and could not see.';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/lives',
  title: 'Lives across the decades',
  description: DESCRIPTION,
});

export default async function LivesIndexPage({
  searchParams,
}: {
  readonly searchParams: Promise<RawLivesSearchParams>;
}) {
  const raw = await searchParams;
  const view = parseLivesSearchParams(raw);
  const livesAreaSlug = parseLivesAreaSlug(raw);
  const area = livesAreaBySlug(livesAreaSlug) ?? LIVES_NATIONAL;
  const loaded = await loadLivesAreaBundle(livesAreaSlug);
  const bundle = loaded ?? emptyLivesAreaBundle(area);

  return (
    <Room>
      <ReadingEntry
        pathname="/lives"
        title="Lives across the decades"
        lede="A region, a lens, a decade, and a named unit. The street hatches from published census tables. Feeling is quoted. Impact is juxtaposition or a gated claim."
        showCrumb={false}
      />
      <DocumentColophon
        facts={[`Area · ${bundle.areaName}`, 'Span · 1870s to 2020s', `Unit · ${view.unit}`]}
      />

      <p className="lives-room__kicker">
        <DestinationIcon id="person" className="ds-kicker-glyph" />
        {LIVES_UNIT_KICKERS[view.unit]}
      </p>

      <Suspense fallback={<LivesTimelineStatic bundle={bundle} areaSlug={livesAreaSlug} />}>
        <LivesTimeline bundle={bundle} areaSlug={livesAreaSlug} />
      </Suspense>

      <WalkOffRamp>
        Every figure names its table. Laws sit beside the numbers, not as their cause. Method on{' '}
        <a href="/methodology#lives-across-decades">Methodology</a>. Compact census spine on{' '}
        <a href="/data#lives">Data</a>.
      </WalkOffRamp>
    </Room>
  );
}

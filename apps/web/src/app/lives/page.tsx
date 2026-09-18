/**
 * `/lives`: immersive Lives Across the Decades room. Region, decade, and emphasis change a
 * hand-drawn street bound to published counts, with sourced world beats opening the archive.
 * `/lives/[region]` still resolves via `?area=`. Data Act II remains a compact entry that links here.
 */
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { LIVES_NATIONAL, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DocumentColophon, ReadingEntry, Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../lib/lives/lives-source';
import { parseLivesAreaSlug, type RawLivesSearchParams } from '../../lib/lives/lives-url-state';
import { LivesTimeline } from '../../components/lives/LivesTimeline';
import { LivesTimelineStatic } from '../../components/lives/LivesTimelineStatic';
import '../reading-room.css';
import './lives.css';

void React;

const DESCRIPTION =
  'How published counts described Black, white and Hispanic lives across regions and decades, with sourced voices, places, laws, and the limits of the record.';

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
  const livesAreaSlug = parseLivesAreaSlug(raw);
  const area = livesAreaBySlug(livesAreaSlug) ?? LIVES_NATIONAL;
  const loaded = await loadLivesAreaBundle(livesAreaSlug);
  const bundle = loaded ?? emptyLivesAreaBundle(area);

  return (
    <Room>
      <ReadingEntry
        pathname="/lives"
        title="Lives across the decades"
        lede="Published counts set the frame. Sourced voices, places, and records open what the numbers cannot."
        showCrumb={false}
      />
      <DocumentColophon facts={[`Area · ${bundle.areaName}`, 'Span · 1870s to 2020s']} />

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

/**
 * `/lives/[region]`: keep regional bookmarks resolving. Renders the immersive room with `?area=`
 * rather than 308ing away, so the street and unit controls stay on this URL.
 */
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { LIVES_AREAS, LIVES_UNIT_KICKERS, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { DocumentColophon, ReadingEntry, Room } from '../../../components/room';
import { WalkOffRamp } from '../../walk-off-ramp';
import { emptyLivesAreaBundle, loadLivesAreaBundle } from '../../../lib/lives/lives-source';
import {
  parseLivesSearchParams,
  type RawLivesSearchParams,
} from '../../../lib/lives/lives-url-state';
import { LivesTimeline } from '../../../components/lives/LivesTimeline';
import { LivesTimelineStatic } from '../../../components/lives/LivesTimelineStatic';
import { DestinationIcon } from '../../../components/patterns/DestinationIcon';
import '../../reading-room.css';
import '../lives.css';

void React;

type LivesAreaPageProps = {
  readonly params: Promise<{ readonly region: string }>;
  readonly searchParams: Promise<RawLivesSearchParams>;
};

export function generateStaticParams(): { region: string }[] {
  return LIVES_AREAS.filter((area) => area.kind === 'region').map((area) => ({
    region: area.slug,
  }));
}

export async function generateMetadata({ params }: LivesAreaPageProps): Promise<Metadata> {
  const { region: slug } = await params;
  const area = livesAreaBySlug(slug);
  if (!area) return {};
  return buildStaticPageMetadata({
    path: `/lives/${area.slug}`,
    title: `${area.name} · Lives across the decades`,
    description: area.summary,
  });
}

export default async function LivesAreaPage({ params, searchParams }: LivesAreaPageProps) {
  const { region: slug } = await params;
  const area = livesAreaBySlug(slug);
  if (!area || area.kind !== 'region') notFound();
  const raw = await searchParams;
  const view = parseLivesSearchParams(raw);
  const loaded = await loadLivesAreaBundle(area.slug);
  const bundle = loaded ?? emptyLivesAreaBundle(area);

  return (
    <Room>
      <ReadingEntry
        pathname={`/lives/${area.slug}`}
        title={area.name}
        lede={area.summary}
        showCrumb={false}
      />
      <DocumentColophon
        facts={[`Area · ${bundle.areaName}`, 'Span · 1870s to 2020s', `Unit · ${view.unit}`]}
      />
      <p className="lives-room__kicker">
        <DestinationIcon id="data" className="ds-kicker-glyph" />
        {LIVES_UNIT_KICKERS[view.unit]}
      </p>
      <Suspense fallback={<LivesTimelineStatic bundle={bundle} areaSlug={area.slug} />}>
        <LivesTimeline bundle={bundle} areaSlug={area.slug} />
      </Suspense>
      <WalkOffRamp>
        Method on <a href="/methodology#lives-across-decades">Methodology</a>. National baseline on{' '}
        <a href="/lives">Lives</a>.
      </WalkOffRamp>
    </Room>
  );
}

/**
 * `/lives/[region]`: the national baseline or one region's timeline, 1870s–2020s.
 *
 * The server renders the default view in full (every decade as a link, the first decade's panel),
 * so readers without JavaScript and crawlers get real tables. The interactive timeline, which reads
 * group, tier and decade from the URL, replaces it after hydration. Not indexed until the public
 * method page and the verification pass are done (beads repo-0clax.17, repo-0clax.14).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { LIVES_AREAS, livesAreaBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { loadLivesAreaBundle } from '../../../lib/lives/lives-source';
import { LivesAreaNav } from '../../../components/lives/LivesAreaNav';
import { LivesTimeline } from '../../../components/lives/LivesTimeline';
import { LivesTimelineStatic } from '../../../components/lives/LivesTimelineStatic';
import { Room, RoomHeader } from '../../../components/room';
import '../../reading-room.css';
import '../lives.css';

export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams(): { region: string }[] {
  return LIVES_AREAS.map((area) => ({ region: area.slug }));
}

type LivesAreaPageProps = {
  readonly params: Promise<{ readonly region: string }>;
};

export async function generateMetadata({ params }: LivesAreaPageProps): Promise<Metadata> {
  const { region: slug } = await params;
  const area = livesAreaBySlug(slug);
  if (!area) return {};
  return buildStaticPageMetadata({
    path: `/lives/${area.slug}`,
    title: `Lives across the decades: ${area.name}`,
    description: `${area.name}: how Black, white and Hispanic Americans were spread across class from the 1870s, what their lives measured, which laws were in force, and what the census could see.`,
    noIndex: true,
  });
}

export default async function LivesAreaPage({ params }: LivesAreaPageProps) {
  const { region: slug } = await params;
  const bundle = await loadLivesAreaBundle(slug);
  if (!bundle) notFound();
  const area = livesAreaBySlug(slug);

  return (
    <Room>
      <RoomHeader
        pathname={`/lives/${slug}`}
        kicker="Lives across the decades"
        title={bundle.areaName}
        lede={
          area?.summary ??
          'Choose a group to emphasize and a class tier, then move through the decades.'
        }
        meta={['1870s to 2020s', 'Published census tables', 'Laws from the catalog']}
      />
      <LivesAreaNav currentSlug={slug} />
      <Suspense fallback={<LivesTimelineStatic bundle={bundle} areaSlug={slug} />}>
        <LivesTimeline bundle={bundle} />
      </Suspense>
    </Room>
  );
}

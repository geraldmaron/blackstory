/**
 * `/lives/[region]`: one region's timeline, 1870s–2020s.
 *
 * The server renders the default view in full (every decade as a link, the first decade's panel),
 * so readers without JavaScript and crawlers get real tables. The interactive timeline, which reads
 * race, tier and decade from the URL, replaces it after hydration. Not indexed until IPUMS confirms
 * public-web use of the tabulations (bead repo-0clax.2).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { LIVES_REGIONS, livesRegionBySlug } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { loadLivesRegionBundle } from '../../../lib/lives/lives-source';
import { LivesTimeline } from '../../../components/lives/LivesTimeline';
import { LivesTimelineStatic } from '../../../components/lives/LivesTimelineStatic';
import { Room, RoomHeader } from '../../../components/room';
import '../../reading-room.css';
import '../lives.css';

export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams(): { region: string }[] {
  return LIVES_REGIONS.map((region) => ({ region: region.slug }));
}

type LivesRegionPageProps = {
  readonly params: Promise<{ readonly region: string }>;
};

export async function generateMetadata({ params }: LivesRegionPageProps): Promise<Metadata> {
  const { region: slug } = await params;
  const region = livesRegionBySlug(slug);
  if (!region) return {};
  return buildStaticPageMetadata({
    path: `/lives/${region.slug}`,
    title: `Lives across the decades: ${region.name}`,
    description: `How Black, white and Hispanic residents of the ${region.name} were spread across class from the 1870s, what their lives measured, and which laws were in force.`,
    noIndex: true,
  });
}

export default async function LivesRegionPage({ params }: LivesRegionPageProps) {
  const { region: slug } = await params;
  const bundle = await loadLivesRegionBundle(slug);
  if (!bundle) notFound();

  return (
    <Room>
      <RoomHeader
        pathname={`/lives/${slug}`}
        kicker="Lives across the decades"
        title={bundle.regionName}
        lede="Choose a group to emphasize and a class tier, then move through the decades. Every figure shows how many census records stand behind it, and says when there are too few to count."
        meta={['1870s to 2020s', 'IPUMS USA census samples', 'Laws from the catalog']}
      />
      <Suspense fallback={<LivesTimelineStatic bundle={bundle} regionSlug={slug} />}>
        <LivesTimeline bundle={bundle} />
      </Suspense>
    </Room>
  );
}

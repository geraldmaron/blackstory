/**
 * Explore is the browse posture of the shared Door map. `/` is the journey (canonical Map
 * product). Nav and casual CTAs morph in place on `/`. Deep links, locate, and share keep
 * `/explore?…` and land already armed on the same Door browse shell (room CommandBar, Journey
 * exit, embedded atlas) — not a second instrument cockpit.
 *
 * Bare `/explore` still renders this route rather than a 308 to `/`: a prior permanent fold left
 * Chrome caching `/explore?_rsc=…` forever (see redirect-table.test.ts). `/explore/api` is
 * unchanged.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DoorHome } from '../door-home';

export const dynamic = 'force-dynamic';

type ExplorePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Bare `/explore` is indexable. Any query (`?state=`, `?kind=`, `?floor=`, …) is a view of the same
 * map whose canonical is already `/explore`, but each distinct URL misses the edge cache and renders
 * in a Vercel function; crawlers reached them through every `/records` narrowing's map hand-off.
 * They are `noindex, nofollow` here and disallowed in robots.txt.
 */
export async function generateMetadata({ searchParams }: ExplorePageProps): Promise<Metadata> {
  const params = await searchParams;
  return buildStaticPageMetadata({
    path: '/explore',
    title: 'Map',
    description: 'The map of the archive, focused.',
    ...(Object.keys(params).length > 0 ? { noIndex: true } : {}),
  });
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  return <DoorHome params={params} initialBrowse />;
}

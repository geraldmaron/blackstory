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
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DoorHome } from '../door-home';

export const dynamic = 'force-dynamic';

export const metadata = buildStaticPageMetadata({
  path: '/explore',
  title: 'Map',
  description: 'The map of the archive, focused.',
});

type ExplorePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  return <DoorHome params={params} initialBrowse />;
}

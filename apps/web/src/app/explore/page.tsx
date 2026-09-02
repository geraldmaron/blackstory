/**
 * Atlas instrument. `/` is the Door (about framing + pin plate). This route is the live catalog.
 */
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { AtlasHome } from '../atlas-home';

export const dynamic = 'force-dynamic';

export const metadata = buildStaticPageMetadata({
  path: '/explore',
  title: 'Explore',
  description: 'The map of the archive.',
});

type ExplorePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  return <AtlasHome params={params} />;
}

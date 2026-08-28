/**
 * Atlas instrument. Not the public front door. `/` is the featured place or story.
 *
 * This route may fetch the catalog. Bare `/` must not.
 */
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { AtlasHome } from '../atlas-home';

export const dynamic = 'force-dynamic';

export const metadata = buildStaticPageMetadata({
  path: '/explore',
  title: 'Atlas',
  description: 'The Atlas answers where and when.',
});

type ExplorePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  return <AtlasHome params={params} />;
}

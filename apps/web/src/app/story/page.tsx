/**
 * `/story`: the retelling as its own page (docs/ui/DESIGN.md section 9.7). The same component
 * opens the front page behind a flag; here it always plays from the first word.
 *
 * Not indexed while it is on trial: until the read test decides whether it becomes the entrance,
 * it would be a second copy of the front page in search results.
 */
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { FrontPage } from '../front/front-page';

export const metadata: Metadata = {
  ...buildStaticPageMetadata({
    path: '/story',
    title: 'History, His story, Her story, Your story, Their story',
    description:
      'Six words, six scenes over the map: what BlackStory is, with three records from the archive.',
  }),
  robots: { index: false, follow: true },
};

export default async function StoryPage() {
  // The live catalog is runtime data. Its loaders cache release data across requests.
  await connection();
  return <FrontPage />;
}

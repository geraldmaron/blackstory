/**
 * `/` is the front page (docs/ui/DESIGN.md section 9.7): the retelling, History to BlackStory, on
 * ink, then the contents on paper. The owner made it the entrance on 2026-11-23; the v12 home
 * film it replaced is deleted. A returning reader lands on the last scene.
 */
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { ABOUT_LINE } from './about/about-copy';
import { FrontPage } from './front/front-page';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical is the bare `/` (SP-19).
 */
export const metadata: Metadata = {
  description: ABOUT_LINE,
  alternates: { canonical: absolutePublicUrl('/') },
};

export default async function HomePage() {
  // The live catalog is runtime data. Its loaders cache release data across requests.
  await connection();
  return <FrontPage returning />;
}

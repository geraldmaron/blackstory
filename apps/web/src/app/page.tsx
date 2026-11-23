/**
 * `/` is the home page (docs/ui/design-direction-v12.md): the title, a journey across the shared
 * map plate, the country, the stories and the receipts. The map itself is `/explore`.
 */
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { ABOUT_LINE } from './about/about-copy';
import { HomePage as Home } from './home/home-page';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19).
 */
export const metadata: Metadata = {
  description: ABOUT_LINE,
  alternates: { canonical: absolutePublicUrl('/') },
};

export default async function HomePage() {
  // The live catalog is runtime data. Its loaders cache release data across requests.
  await connection();
  return <Home />;
}

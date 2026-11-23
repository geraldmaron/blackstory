/**
 * `/` is the front page. By default it is the home page of docs/ui/archive/design-direction-v12.md
 * (the title, a journey across the shared map, the country, the stories and the receipts).
 *
 * `/?opening=1` shows the v13 front page instead (docs/ui/DESIGN.md section 9.7): the retelling,
 * then the contents. The switch is a query parameter so both can be compared on any deployment;
 * the default flips, and `home/` is deleted, only after the read test (docs/ui/v13/read-test-front.md).
 */
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { FRONT_OPENING_PARAM } from '../lib/runtime-hardening/query-normalization';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { ABOUT_LINE } from './about/about-copy';
import { FrontPage } from './front/front-page';
import { HomePage as Home } from './home/home-page';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19), with or without the switch.
 */
export const metadata: Metadata = {
  description: ABOUT_LINE,
  alternates: { canonical: absolutePublicUrl('/') },
};

export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The live catalog is runtime data. Its loaders cache release data across requests.
  await connection();
  if ((await searchParams)[FRONT_OPENING_PARAM] === '1') return <FrontPage returning />;
  return <Home />;
}

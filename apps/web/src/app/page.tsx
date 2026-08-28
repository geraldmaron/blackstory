/**
 * `/` is the public front door. First paint is one released place (or a published story),
 * not a 4,101-record filter board and not that board behind a query string.
 *
 * The Atlas instrument lives at `/explore`. This module never imports it.
 */
import type { Metadata } from 'next';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { ABOUT_LINE } from './about/about-copy';
import { HomeFirstPaint } from './HomeFirstPaint';
import { loadHomeFirstPaint } from './home-first-paint';

/**
 * Dynamic because a build without a database must not prerender a live featured place.
 * Keep this page-scoped; do not hoist force-dynamic to the root layout.
 */
export const dynamic = 'force-dynamic';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19).
 */
export const metadata: Metadata = {
  description: ABOUT_LINE,
  alternates: { canonical: absolutePublicUrl('/') },
};

export default async function HomePage() {
  const model = await loadHomeFirstPaint();
  return <HomeFirstPaint model={model} />;
}

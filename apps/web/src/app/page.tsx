/**
 * `/` is the public front door. First paint is one released place (or a small featured set),
 * not a 4,101-record filter board. `/about` already tells a story; that is not a substitute
 * for changing this route.
 *
 * This module's static imports are the featured door only. The instrument loads from
 * `./atlas-home` when the URL asks (`?atlas=1` or a surviving explore filter).
 * `/explore` and `/map` 308 to `/?atlas=1`.
 *
 * Bare `/` uses `loadHomeFirstPaint` (thin ID read + optional lead story).
 */
import type { Metadata } from 'next';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { wantsAtlasInstrument } from '../lib/nav/atlas-door';
import { HomeFirstPaint } from './HomeFirstPaint';
import { loadHomeFirstPaint } from './home-first-paint';

/**
 * Dynamic because it reads `searchParams` (door vs Atlas), and because a build without a
 * database must not prerender a live featured place. Keep this page-scoped; do not hoist
 * force-dynamic to the root layout.
 */
export const dynamic = 'force-dynamic';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19). Filter permutations of the Atlas still collapse here.
 */
export const metadata: Metadata = {
  description:
    'History, pinned to place. Start with one documented record, then open the map when you want the archive.',
  alternates: { canonical: absolutePublicUrl('/') },
};

type HomePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  if (wantsAtlasInstrument(params)) {
    const { AtlasHome } = await import('./atlas-home');
    return <AtlasHome params={params} />;
  }

  const model = await loadHomeFirstPaint();
  return <HomeFirstPaint model={model} />;
}

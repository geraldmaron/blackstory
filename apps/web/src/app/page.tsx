/**
 * `/` is the public front door. First paint is the featured place's record,
 * not a 4,101-record filter board and not that board behind a query string.
 *
 * The Atlas instrument lives at `/explore`. This module never imports it.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { STAND_COOKIE, isPublicPlaceSlug } from '../lib/place/public-place-path';
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

function namedStand(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isPublicPlaceSlug(trimmed)) return undefined;
  return trimmed;
}

export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly at?: string | readonly string[] }>;
}) {
  const params = await searchParams;
  const at = Array.isArray(params.at) ? params.at[0] : params.at;
  const cookieStore = await cookies();
  const named = namedStand(at) ?? namedStand(cookieStore.get(STAND_COOKIE)?.value);
  const model = await loadHomeFirstPaint(named ? { namedSlug: named } : {});
  return <HomeFirstPaint model={model} />;
}

/**
 * `/` is the Atlas: one full-viewport live plate with opaque panels floating over it.
 * A place is a page you walk into (`/place/{slug}`). This module mounts the existing
 * Atlas instrument. It does not invent a second map.
 *
 * The plate itself is mounted once by the root shell and persists across navigation; this page
 * only builds the view model and hands the pin collection to `AtlasLoader` / `AtlasExperience`
 * so first paint is not an empty plate. Filters use native GET navigation so the surface works
 * without JavaScript. The camera stays in memory, so the shareable URL carries filters and
 * selection but never pan or zoom (ADR-017).
 */
import type { Metadata } from 'next';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { AtlasHome } from './atlas-home';

/**
 * Dynamic because it reads `searchParams` (the filters are GET navigation), and because a build
 * without a database must not prerender a live catalog. Keep this page-scoped; do not hoist
 * force-dynamic to the root layout.
 */
export const dynamic = 'force-dynamic';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19).
 */
export const metadata: Metadata = {
  description:
    'Map-first national view of documented Black history: every geo-anchored record in the active release.',
  alternates: { canonical: absolutePublicUrl('/') },
};

type AtlasPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: AtlasPageProps) {
  const params = await searchParams;
  return <AtlasHome params={params} formAction="/" />;
}

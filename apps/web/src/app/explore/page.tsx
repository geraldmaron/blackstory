/**
 * `/explore` is the map view's 4a address. While the phase 4b redirects are on, the proxy answers
 * it with a 307 to `/archive?view=map` before this file runs. It stays so that switching the
 * redirects off (`lib/redirects/archive-redirects.mjs`) brings the address back with no other
 * change. `/explore/api` is unchanged.
 */
import type { Metadata } from 'next';
import type { ArchiveParams } from '../archive/list-view';
import { MapView, mapMetadata } from '../archive/map-view';

export const dynamic = 'force-dynamic';

type ExplorePageProps = { readonly searchParams: Promise<ArchiveParams> };

export async function generateMetadata({ searchParams }: ExplorePageProps): Promise<Metadata> {
  return mapMetadata(await searchParams);
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  return <MapView params={await searchParams} />;
}

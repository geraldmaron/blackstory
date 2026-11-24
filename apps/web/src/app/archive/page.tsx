/**
 * `/archive`: one page, one filter model, three views (docs/ui/DESIGN.md 9.2,
 * docs/ui/archive-url-contract.md section 10). The list is the default view and the timeline is
 * the same rows along time; `view=map` is the working map with its list column. A lens that has
 * its own catalog (`/law`, `/books`) renders through `ArchiveHead` on its own address.
 *
 * No `loading.tsx`: a segment loading file streams the page into a block only script reveals, so
 * the list would not read without JavaScript.
 */
import type { Metadata } from 'next';
import { ListView, listMetadata, type ArchiveParams } from './list-view';
import { MapView, mapMetadata } from './map-view';

// Every address is one reader's filter set over live data; nothing here is a static page.
export const dynamic = 'force-dynamic';

type ArchivePageProps = { readonly searchParams: Promise<ArchiveParams> };

function isMap(params: ArchiveParams): boolean {
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  return view?.trim().toLowerCase() === 'map';
}

export async function generateMetadata({ searchParams }: ArchivePageProps): Promise<Metadata> {
  const params = await searchParams;
  return isMap(params) ? mapMetadata(params) : listMetadata(params);
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const params = await searchParams;
  return isMap(params) ? <MapView params={params} /> : <ListView params={params} />;
}

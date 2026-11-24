/**
 * `/records` is the list's 4a address. While the phase 4b redirects are on, the proxy answers it
 * with a 307 to `/archive` before this file runs. It stays so that switching the redirects off
 * (`lib/redirects/archive-redirects.mjs`) brings the address back with no other change.
 */
import type { Metadata } from 'next';
import { ListView, listMetadata, type ArchiveParams } from '../archive/list-view';

type RecordsPageProps = { readonly searchParams: Promise<ArchiveParams> };

export async function generateMetadata({ searchParams }: RecordsPageProps): Promise<Metadata> {
  return listMetadata(await searchParams);
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  return <ListView params={await searchParams} />;
}

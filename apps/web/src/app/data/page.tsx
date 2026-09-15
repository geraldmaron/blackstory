/**
 * `/data` — crawlable deep link into the apparatus Data section.
 */
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { DATA_PAGE_DESCRIPTION } from './data-copy';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/data',
  title: 'Data',
  description: DATA_PAGE_DESCRIPTION,
});

export default function DataPage() {
  permanentRedirect('/apparatus?s=data');
}

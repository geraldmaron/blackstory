/**
 * `/lives`: 308 into the apparatus Data section. Bookmarks and inbound links keep resolving.
 */
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';

const DESCRIPTION =
  'How Black, white and Hispanic Americans were spread across class, decade by decade from the 1870s, what their lives measured, which laws were in force, and what the census could and could not see.';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/lives',
  title: 'Lives across the decades',
  description: DESCRIPTION,
  noIndex: true,
});

export default function LivesIndexPage() {
  permanentRedirect('/apparatus?s=lives');
}

/**
 * `/about` — crawlable deep link into the apparatus About section.
 */
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/about',
  title: 'About',
  description:
    'BlackStory is a place-connected Black history archive, built by one person so documented history stays findable, and kept open so other people can add to it.',
});

export default function AboutPage() {
  permanentRedirect('/apparatus?s=about');
}

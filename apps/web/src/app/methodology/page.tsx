/**
 * `/methodology` — crawlable deep link into the apparatus Methodology section.
 */
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/methodology',
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies as a record, checks it against independent sources, grades how sure the evidence is, keeps the addresses of living people off the map, and corrects itself in the open.',
});

export default function MethodologyPage() {
  permanentRedirect('/apparatus?s=methodology');
}

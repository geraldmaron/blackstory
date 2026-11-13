/**
 * Public privacy policy for the BlackStory website. Honest inventory of what
 * the site processes, explicit non-collection rules, and the published contact.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import '../utility.css';
import { PrivacySections } from './PrivacySections';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/privacy',
  title: 'Privacy policy',
  description:
    'How BlackStory handles information on the public website: no accounts, no advertising, and location only when you ask for it.',
});

export default function PrivacyPage() {
  return (
    <Room width="read">
      <PageHeader
        crumb={parentCrumb('/privacy')}
        linkAs={Link}
        title="What this site collects, and what it won't"
        dek="What the BlackStory website processes, and what it deliberately does not. There are no accounts and no advertising, and the map asks for your location only when you press a control that says so."
      />
      <PrivacySections />
    </Room>
  );
}

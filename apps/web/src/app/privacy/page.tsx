/**
 * Public privacy policy for BlackStory web and mobile store gates. Honest inventory of what
 * each surface processes, explicit non-collection rules, and owner placeholders until legal
 * entity and support contact are resolved.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room, RoomHeader } from '../../components/room';
import '../utility.css';
import { PrivacySections } from './PrivacySections';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/privacy',
  title: 'Privacy policy',
  description:
    'How BlackStory handles information on the public website and native mobile reader — no accounts at launch, no ad or tracking SDKs, optional location only.',
});

export default function PrivacyPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/privacy"
        kicker="Trust"
        title="Privacy policy"
        lede="An honest inventory of what BlackStory's public website and native reader may process — and what they deliberately do not collect. No accounts at launch. No advertising or tracking SDKs. Location is optional on the web and not requested by the mobile app at launch."
      />
      <PrivacySections />
    </Room>
  );
}

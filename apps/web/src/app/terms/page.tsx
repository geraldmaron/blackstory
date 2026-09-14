/**
 * Public terms notice for BlackStory. A notice, not a contract: every clause on this page is a
 * true statement about how the archive is run, so none of it depends on a reader having clicked
 * an agreement they never saw.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import '../utility.css';
import { TermsSections } from './TermsSections';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/terms',
  title: 'Terms',
  description:
    'What BlackStory publishes and on what footing: free to read, CC BY 4.0 on its own writing, third-party material under its own terms, and how to get a record about you fixed.',
});

export default function TermsPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/terms"
        kicker="Trust"
        title="Terms"
        lede="A notice, not a contract. Reading BlackStory asks nothing of you, so nothing here is written as a bargain: it states what the archive publishes, what you may do with it, and what happens when it gets something wrong."
      />
      <TermsSections />
      <WalkOffRamp>What this archive publishes, and on what footing.</WalkOffRamp>
    </Room>
  );
}

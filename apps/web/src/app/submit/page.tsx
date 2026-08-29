/**
 * Public "submit a lead" entry point. v9 utility room for moderated quarantine
 * intake — nothing submitted here is public.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { EmptyState, Notice } from '@repo/ui';
import { Room, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import '../utility.css';
import { SubmitLeadForm } from './SubmitLeadForm';

export const revalidate = 86400;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/submit',
  title: 'Submit a lead',
  description:
    'Point BlackStory toward a lead: a closed group post, a family paper, an oral account. Moderated review.',
});

export default function SubmitLeadPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/submit"
        kicker="Contribute"
        title="Submit a lead"
        lede="Some of the most important sources for this history live where no compliant automated search can reach: closed Facebook groups, Discord servers, private forums, family papers, oral memory. If you know of one, tell us here."
      />

      <Notice tone="warning" title="This is not a public post">
        Leads submitted here are never published as-is. Every submission enters a moderated
        quarantine queue, is reviewed independently by multiple reviewers, and seeds a private
        research case only if those reviewers agree it is worth pursuing. It still has to pass the
        full research and fact-checking process before anything about it is ever public. Please do
        not include anyone's home address or other sensitive personal details about a living person.
      </Notice>

      <SubmitLeadForm />

      <EmptyState title="What happens after you submit">
        A lead is never published on arrival. Several people read it independently. If they agree
        it is worth pursuing, it becomes a private research candidate. If they disagree, a person
        decides. Disagreement is never silently averaged away. See{' '}
        <a href="/methodology">how a record gets in</a>.
      </EmptyState>

      <WalkOffRamp title="The place">
        Nothing you send here is public on arrival.
      </WalkOffRamp>
    </Room>
  );
}

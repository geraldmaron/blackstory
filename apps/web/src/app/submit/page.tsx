/**
 * Public "submit a lead" entry point. v9 utility room for moderated quarantine
 * intake — nothing submitted here is public.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { EmptyState, Notice, PageHeader } from '@repo/ui';
import { parentCrumb, Room, RoomSection } from '../../components/room';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import '../utility.css';
import { SubmitLeadForm } from './SubmitLeadForm';

export const revalidate = 86400;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/submit',
  title: 'Submit a lead',
  description:
    'Point BlackStory toward a lead: a closed group post, a family paper, an oral account. Moderated review, and nothing public on arrival.',
});

export default function SubmitLeadPage() {
  return (
    <Room width="read">
      <PageHeader
        crumb={parentCrumb('/submit')}
        linkAs={Link}
        title="Tell the archive what it's missing"
        dek="Some of the most important sources for this history sit where no compliant automated search can reach them: closed Facebook groups, Discord servers, private forums, family papers in a shoebox, an account nobody ever wrote down. If you know of one, this is where to say so."
      />

      <RoomSection id="lead" title="What you know">
        <Notice tone="note" title="This is not a public post">
          Leads submitted here are never published as sent. I read every lead. A submission that is
          worth pursuing still has to clear the full research and fact-checking process before
          anything about it is public. Please do not include anyone's home address or other
          sensitive personal details about a living person.
        </Notice>

        <SubmitLeadForm />

        <EmptyState title="What happens after you submit">
          A lead is never published on arrival. I read it, after a screen that holds likely-hate
          aside. If it is worth pursuing it becomes a private research candidate. See{' '}
          <a href="/faq#ai">how AI is used</a>
          {' · '}
          <a href="/methodology">how a record gets in</a>. If a form is the wrong shape for what you
          have, write to <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> instead.
        </EmptyState>
      </RoomSection>
    </Room>
  );
}

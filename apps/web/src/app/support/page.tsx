/**
 * `/support`: how to get an answer. A question about a record is a correction; anything else is
 * an email to the person who reads the mailbox. One primary action, the address, then where the
 * answers that already exist live.
 *
 * The contact block speaks as Gerald Dagher, because that is who reads the mailbox.
 * `SUPPORT_CONTACT` is his own address by decision (lib/config/contact.ts), and a
 * "contact the team" line over a personal inbox would be the page's only untrue sentence.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Button, PageHeader } from '@repo/ui';
import { parentCrumb, Room, RoomSection } from '../../components/room';
import { TrustLinks } from '../../components/trust';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import '../utility.css';
import '../../components/trust/trust.css';
import './support.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/support',
  title: 'Support',
  description:
    'How to report a correction, read the BlackStory trust documentation, and reach the person who runs it.',
});

export default function SupportPage() {
  return (
    <Room width="read">
      <PageHeader
        crumb={parentCrumb('/support')}
        linkAs={Link}
        title="How to get an answer"
        dek="One person runs BlackStory and reads everything that comes in."
      />

      <RoomSection id="record" title="Something in a record is wrong">
        <p className="ds-trust-lead">
          File it as a correction: a person reads it against the published sources, and you get a
          receipt code to check the outcome.
        </p>
        <div className="ds-support__action">
          <Button href="/corrections">Report a correction</Button>
        </div>
      </RoomSection>

      <RoomSection id="contact" title="Anything else">
        <p className="ds-trust-lead">
          Write to me directly about how the archive is run, a privacy request, or an accessibility
          barrier that keeps you out of a page.
        </p>
        <p className="ds-support__email">
          <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>
        </p>
        <p className="ds-trust-note">
          A reply can take a few days. Most privacy questions are already answered in the{' '}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </RoomSection>

      <RoomSection id="answers" title="Answers that already exist">
        <TrustLinks
          links={[
            {
              href: '/faq',
              title: 'Questions',
              line: 'Who runs this, how AI is used, and why coverage is uneven.',
            },
            {
              href: '/methodology',
              title: 'Methodology',
              line: 'How a record gets in, what its grade means, and the rules about place.',
            },
            {
              href: '/errata',
              title: 'Errata',
              line: 'Every correction already published, newest first.',
            },
          ]}
        />
      </RoomSection>
    </Room>
  );
}

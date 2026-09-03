/**
 * Public support page for BlackStory. Primary path is the corrections lane;
 * methodology, errata, and a contact address sit beside it.
 *
 * The contact block speaks as Gerald Dagher, because that is who reads the mailbox.
 * `SUPPORT_CONTACT` is his own address by decision (lib/config/contact.ts), and a
 * "contact the team" line over a personal inbox would be the page's only untrue sentence.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room, RoomHeader, Prose, CardGrid, RoomCard, UtilityCard } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import '../utility.css';
import './support.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/support',
  title: 'Support',
  description:
    'How to report a correction, read the BlackStory trust documentation, and reach the person who runs it.',
});

const SUPPORT_PATHS = [
  {
    href: '/corrections',
    label: 'Report a correction',
    detail:
      'Say a published record is wrong, or point at evidence it is missing. Submissions enter moderated review, and nothing changes publicly until a person accepts it. You get a receipt code.',
  },
  {
    href: '/methodology',
    label: 'Read the methodology',
    detail:
      'Definitions, source rules, confidence grades, map dignity limits, and how corrections are handled.',
  },
  {
    href: '/errata',
    label: 'Browse the errata log',
    detail: 'Corrections, clarifications, updates, and editor notes already applied, newest first.',
  },
] as const;

export default function SupportPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/support"
        kicker="Help"
        title="Support"
        lede="BlackStory is one person's archive of Black history, tied to the places it happened. If something in a record is wrong, corrections is the fastest way in: it is moderated, it gives you a receipt code, and nothing is published as submitted."
        showPath={false}
      />

      <UtilityCard className="ds-support__section-paths">
        <Prose>
          <p className="ds-support__section-intro">
            A question about one specific record is best filed as a correction, because that puts
            what you wrote next to the published sources when someone reads it.
          </p>
        </Prose>
        <CardGrid>
          {SUPPORT_PATHS.map((path) => (
            <RoomCard
              key={path.href}
              href={path.href}
              kind="OPTION"
              title={path.label}
              description={path.detail}
            />
          ))}
        </CardGrid>
      </UtilityCard>

      <UtilityCard title="Reach me" className="ds-support__section-contact">
        <Prose>
          <p className="ds-support__contact-intro">
            For anything the corrections form has no field for (how the archive is run, a privacy
            request, an accessibility barrier that keeps you out of a page), write to me directly.
          </p>
        </Prose>

        <div className="ds-support__contact">
          <p className="ds-support__contact-label">Email</p>
          <p className="ds-support__contact-value">
            <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>
          </p>
        </div>

        <p className="ds-support__follow">
          Most privacy questions are already answered on the{' '}
          <Link href="/privacy">privacy policy</Link> page. One person builds and runs BlackStory,
          so a reply can take a few days. I read everything that comes in, and I'll keep this
          running for as long as I can.
        </p>
      </UtilityCard>

      <WalkOffRamp>Saying a record is wrong is the fastest way to change what it says.</WalkOffRamp>
    </Room>
  );
}

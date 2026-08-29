/**
 * Public support page for BlackStory. Primary path is the corrections lane;
 * methodology, errata, and a contact address sit beside it.
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
    'How to report corrections, read BlackStory trust documentation, and reach the team.',
});

const SUPPORT_PATHS = [
  {
    href: '/corrections',
    label: 'Report a correction',
    detail:
      'Challenge a published record or suggest missing evidence. Submissions enter moderated review, and nothing changes publicly until a person accepts it.',
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
    detail:
      'Reverse-chronological record of corrections, clarifications, updates, and editor notes already applied.',
  },
] as const;

export default function SupportPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/support"
        kicker="Help"
        title="Support"
        lede="BlackStory is a place-connected research archive. The fastest path for factual issues is the corrections lane: moderated, receipted, and never published as submitted."
        showPath={false}
      />

      <UtilityCard className="ds-support__section-paths">
        <Prose>
          <p className="ds-support__section-intro">
            Most questions about a specific record are best handled through corrections so
            a person can read your report against the published sources.
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

      <UtilityCard title="Reach the team" className="ds-support__section-contact">
        <Prose>
          <p className="ds-support__contact-intro">
            For issues that do not fit the corrections form (how the product is run, privacy
            requests, or accessibility barriers), email the contact below.
          </p>
        </Prose>

        <div className="ds-support__contact">
          <p className="ds-support__contact-label">Support contact</p>
          <p className="ds-support__contact-value">
            <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>
          </p>
        </div>

        <p className="ds-support__follow">
          Privacy questions: see the <Link href="/privacy">privacy policy</Link>. This product is
          BlackStory.
        </p>
      </UtilityCard>

      <WalkOffRamp title="The place">Help for BlackStory, not a store listing.</WalkOffRamp>
    </Room>
  );
}

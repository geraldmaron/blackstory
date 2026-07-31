/**
 * Public support page for BlackStory store gates. Primary path is the corrections lane;
 * secondary trust surfaces and a contact placeholder until the owner sets a live address.
 *
 * v9 utility room kit edition. This is a UTILITY room: task surface for helping readers
 * find corrections, methodology, and contact information.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room, RoomHeader, Prose, CardGrid, RoomCard, UtilityCard } from '../../components/room';
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
      'Challenge a published record, suggest missing evidence, or report a precision issue. Submissions enter moderated review — nothing changes publicly until it passes independent review.',
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
        lede="BlackStory is a place-connected research archive. The fastest path for factual issues is the corrections lane — moderated, receipted, and never published as submitted."
        showPath={false}
      />

      <UtilityCard className="ds-support__section-paths">
        <Prose>
          <p className="ds-support__section-intro">
            Most questions about a specific record are best handled through corrections so
            moderators can tie your report to the published projection and sources.
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
            For issues that do not fit the corrections form — account of operation questions,
            privacy requests, or accessibility barriers — email the contact below.
          </p>
        </Prose>

        <div className="ds-support__contact">
          <p className="ds-support__contact-label">Support contact</p>
          <p className="ds-support__contact-value">
            <a href="mailto:me@geralddagher.com">me@geralddagher.com</a>
          </p>
        </div>

        <p className="ds-support__follow">
          Privacy questions: see the <Link href="/privacy">privacy policy</Link>. Store listings
          link here and to that policy; both URLs must be live on{' '}
          <span className="ds-phrase-nowrap">blackbook.app</span> before app store submission.
        </p>
      </UtilityCard>
    </Room>
  );
}

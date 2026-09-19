/**
 * Privacy policy page sections for the BlackStory website: scope, what the
 * site may process, explicit non-collection rules, optional location,
 * corrections intake, and the published contact.
 *
 * Two speakers, kept distinct on purpose. The site states what the software does
 * ("the site never asks you to sign in"); Gerald Dagher states what he will and
 * will not do with what the software holds ("I do not sell them"). There is no
 * institution here, and an institutional "we" on a privacy page would be the one
 * lie a reader has no way to check.
 */
import React from 'react';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import Link from 'next/link';
import { RoomJump, RoomSection, roomSectionTone } from '../../components/room';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import './privacy.css';

void React;

const PAGE_SECTIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly icon: DestinationIconId;
}[] = [
  { id: 'scope', label: 'Scope', icon: 'about' },
  { id: 'web', label: 'Website', icon: 'records' },
  { id: 'not-collected', label: 'Not collected', icon: 'privacy' },
  { id: 'location', label: 'Location', icon: 'precision' },
  { id: 'integrity', label: 'Abuse checks', icon: 'evidence' },
  { id: 'corrections', label: 'Corrections', icon: 'correction' },
  { id: 'changes', label: 'Changes', icon: 'support' },
];

const WEB_INVENTORY = [
  {
    id: 'reading',
    term: 'Public reading',
    definition:
      'Browsing maps, records, stories, and trust pages does not require an account. The site never asks you to sign in to read a published page.',
  },
  {
    id: 'integrity',
    term: 'Request integrity',
    definition:
      'Some interactive features (search refine, corrections, and lead submission) use a same-origin request-integrity token paired with an HttpOnly cookie. The token proves a request came from this site. It does no advertising and no cross-site tracking.',
  },
  {
    id: 'location',
    term: 'Optional location lookup',
    definition:
      'If you choose to share device location or enter an address or ZIP on the map, that input is sent to the U.S. Census Bureau public geocoder to resolve state, county, and (when applicable) city. Exact coordinates and typed addresses are discarded after resolution; they are not kept as a search history.',
  },
  {
    id: 'hosting',
    term: 'Standard hosting logs',
    definition:
      'Hosting infrastructure may record IP address, user agent, request path, and timestamps in server logs, for security and reliability. Those logs are operational. I do not sell them, nothing in them is used for ad targeting, and there is no account for them to be linked to.',
  },
  {
    id: 'web-analytics',
    term: 'Visit measurement',
    definition:
      'The public site records pageviews and a coarse traffic class (likely human, automated, search crawler, AI crawler, or tool) so I can tell readers apart from scrapers. The class is one of those five values and nothing more: no user id, no stored fingerprint, no advertising use.',
  },
] as const;

const NOT_COLLECTED_RULES = [
  'There are no user accounts. Nothing on this site asks you to make one.',
  'No advertising, no ad identifiers, and no tracking prompts.',
  'I do not sell personal information, and the site does no cross-context behavioral advertising.',
] as const;

function InventoryLedger({
  items,
  label,
}: {
  readonly items: readonly {
    readonly id: string;
    readonly term: string;
    readonly definition: string;
  }[];
  readonly label: string;
}) {
  return (
    <div className="ds-privacy__ledger" aria-label={label}>
      {items.map((item) => (
        <article key={item.id} className="ds-privacy__ledger-item">
          <div className="ds-privacy__ledger-head">
            <span className="ds-privacy__chip">{item.term}</span>
          </div>
          <p className="ds-privacy__ledger-summary">{item.definition}</p>
        </article>
      ))}
    </div>
  );
}

export function PrivacySections() {
  return (
    <div className="ds-privacy">
      <RoomJump sections={PAGE_SECTIONS} />

      <RoomSection
        id="scope"
        icon="about"
        kicker="Who this covers"
        title="BlackStory public website"
        tone={roomSectionTone(0)}
      >
        <p className="ds-privacy__follow">
          This policy describes how BlackStory handles information on{' '}
          <span className="ds-phrase-nowrap">blackstory.app</span>. It covers what the site does
          now. It is not a promise about features that do not exist yet.
        </p>
        <p className="ds-privacy__follow">
          Data controller: <strong>Gerald Dagher</strong> (individual).
        </p>
        <p className="ds-privacy__meta">Last updated: August 2026</p>
      </RoomSection>

      <RoomSection
        id="web"
        icon="records"
        kicker="Website"
        title="What this site may process"
        tone={roomSectionTone(1)}
      >
        <p className="ds-privacy__follow">
          The public website is read-first. Interactive flows are optional and labeled before you
          use them.
        </p>
        <InventoryLedger items={WEB_INVENTORY} label="Website data inventory" />
        <p className="ds-privacy__follow">
          For how published records are verified and corrected, see{' '}
          <Link href="/methodology">methodology</Link> and the{' '}
          <Link href="/corrections">corrections lane</Link>.
        </p>
      </RoomSection>

      <RoomSection
        id="not-collected"
        icon="privacy"
        kicker="Explicit limits"
        title="What I do not collect"
        tone={roomSectionTone(2)}
      >
        <p className="ds-privacy__follow">
          These are rules the software follows. If a release ever adds one of the things listed
          here, this page changes before that release ships.
        </p>
        <ol className="ds-privacy__rule-strip" aria-label="Limits on what is collected">
          {NOT_COLLECTED_RULES.map((rule) => (
            <li key={rule} className="ds-privacy__rule-row">
              <span className="ds-privacy__rule-text">{rule}</span>
            </li>
          ))}
        </ol>
      </RoomSection>

      <RoomSection
        id="location"
        icon="precision"
        kicker="Optional location"
        title="Location is never required"
        tone={roomSectionTone(3)}
      >
        <p className="ds-privacy__follow">
          Location lookup starts only after you press a labeled control; the page never requests
          device location automatically. You can always browse by state or search by place name
          instead.
        </p>
      </RoomSection>

      <RoomSection
        id="integrity"
        icon="evidence"
        kicker="Abuse protection"
        title="What the abuse checks look at"
        tone={roomSectionTone(4)}
      >
        <p className="ds-privacy__follow">
          Pages that could be hit at scale (search, corrections, lead submission) sit behind rate
          limits and same-origin checks. Nothing those checks record is used to build a marketing
          profile.
        </p>
      </RoomSection>

      <RoomSection
        id="corrections"
        icon="correction"
        kicker="Submissions"
        title="Corrections and leads"
        tone={roomSectionTone(5)}
      >
        <p className="ds-privacy__follow">
          When you file a correction, appeal, abuse report, or research lead, you choose what to
          write. Submissions enter a restricted quarantine queue, are kept so they can be opened
          later, and are never published as submitted. A screen runs over incoming mail before I
          read it, so likely-hate is held aside and handled separately. Submissions are not used to
          train models. The optional contact fields are used only to follow up with you about that
          submission, and they are never shown publicly.
        </p>
        <p className="ds-privacy__follow">
          Read the corrections privacy notice on the{' '}
          <Link href="/corrections">corrections page</Link> before submitting. Do not include
          anyone&apos;s home address or other sensitive personal details about a living person
          unless strictly necessary for the correction.
        </p>
      </RoomSection>

      <RoomSection
        id="changes"
        icon="support"
        kicker="Updates"
        title="Changes and contact"
        tone={roomSectionTone(6)}
      >
        <p className="ds-privacy__follow">
          A material change to this policy is posted here, with a new date at the top. For a privacy
          request, or a question about how any of this runs, write to{' '}
          <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> or use the{' '}
          <Link href="/support">support page</Link>.
        </p>
      </RoomSection>
    </div>
  );
}

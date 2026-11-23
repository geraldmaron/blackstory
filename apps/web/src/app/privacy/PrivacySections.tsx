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
import { RoomJump, RoomSection } from '../../components/room';

void React;

const PAGE_SECTIONS: readonly {
  readonly id: string;
  readonly label: string;
}[] = [
  { id: 'scope', label: 'Scope' },
  { id: 'web', label: 'Website' },
  { id: 'not-collected', label: 'Not collected' },
  { id: 'location', label: 'Location' },
  { id: 'integrity', label: 'Abuse checks' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'changes', label: 'Changes' },
];

const WEB_INVENTORY = [
  {
    id: 'reading',
    term: 'Public reading',
    definition:
      'Browsing maps, records, stories, and trust pages doesn’t require an account. The site never asks you to sign in to read a published page.',
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
      'If you choose to share device location or enter an address or ZIP on the map, that input is sent to the U.S. Census Bureau public geocoder to resolve state, county, and (when applicable) city. Exact coordinates and typed addresses are discarded after resolution; they aren’t kept as a search history.',
  },
  {
    id: 'hosting',
    term: 'Standard hosting logs',
    definition:
      'Hosting infrastructure may record IP address, user agent, request path, and timestamps in server logs, for security and reliability. Those logs are operational. I don’t sell them, nothing in them is used for ad targeting, and there’s no account for them to be linked to.',
  },
  {
    id: 'web-analytics',
    term: 'Visit measurement',
    definition:
      'The public site records pageviews and a coarse traffic class (likely human, automated, search crawler, AI crawler, or tool) so I can tell readers apart from scrapers. The class is one of those five values and nothing more, with no user id, no stored fingerprint, and no advertising use.',
  },
] as const;

const NOT_COLLECTED_RULES = [
  'There are no user accounts. Nothing on this site asks you to make one.',
  'No advertising, no ad identifiers, and no tracking prompts.',
  'I don’t sell personal information, and the site does no cross-context behavioral advertising.',
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
    <dl className="ds-trust-dl ds-trust-dl--split" aria-label={label}>
      {items.map((item) => (
        <div key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PrivacySections() {
  return (
    <>
      <RoomJump sections={PAGE_SECTIONS} />

      <RoomSection id="scope" title="BlackStory public website">
        <p className="ds-trust-copy">
          This policy describes how BlackStory handles information on{' '}
          <span className="ds-phrase-nowrap">blackstory.app</span>. It covers what the site does
          now. It isn’t a promise about features that don’t exist yet.
        </p>
        <p className="ds-trust-copy">
          Data controller: <strong>Gerald Dagher</strong> (individual).
        </p>
        <p className="ds-trust-meta">Last updated: August 2026</p>
      </RoomSection>

      <RoomSection id="web" title="What this site may process">
        <p className="ds-trust-copy">
          You can read everything here without handing anything over. The interactive parts are
          optional, and each one is labeled before you use it.
        </p>
        <InventoryLedger items={WEB_INVENTORY} label="Website data inventory" />
        <p className="ds-trust-copy">
          For how published records are verified and corrected, see{' '}
          <Link href="/methodology">methodology</Link> and the{' '}
          <Link href="/corrections">corrections lane</Link>.
        </p>
      </RoomSection>

      <RoomSection id="not-collected" title="What I don’t collect">
        <p className="ds-trust-copy">
          These are rules the software follows. If a release ever adds one of the things listed
          here, this page changes before that release ships.
        </p>
        <ul className="ds-trust-list" aria-label="Limits on what is collected">
          {NOT_COLLECTED_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </RoomSection>

      <RoomSection id="location" title="Location is never required">
        <p className="ds-trust-copy">
          Location lookup starts only after you press a labeled control; the page never requests
          device location automatically. You can always browse by state or search by place name
          instead.
        </p>
      </RoomSection>

      <RoomSection id="integrity" title="What the abuse checks look at">
        <p className="ds-trust-copy">
          Pages that could be hit at scale (search, corrections, lead submission) sit behind rate
          limits and same-origin checks. Nothing those checks record is used to build a marketing
          profile.
        </p>
      </RoomSection>

      <RoomSection id="corrections" title="Corrections and leads">
        <p className="ds-trust-copy">
          When you file a correction, appeal, abuse report, or research lead, you choose what to
          write. Submissions go into a private queue, are kept so they can be opened later, and are
          never published as submitted. A screen runs over incoming mail before I read it, so
          likely-hate is held aside and handled separately. Submissions aren’t used to train models.
          The optional contact fields are used only to follow up with you about that submission, and
          they are never shown publicly.
        </p>
        <p className="ds-trust-copy">
          Read the corrections privacy notice on the{' '}
          <Link href="/corrections">corrections page</Link> before submitting. Don’t include
          anyone&apos;s home address or other sensitive personal details about a living person
          unless strictly necessary for the correction.
        </p>
      </RoomSection>

      <RoomSection id="changes" title="Changes and contact">
        <p className="ds-trust-copy">
          A material change to this policy is posted here, with a new date at the top. For a privacy
          request, or a question about how any of this runs, write to{' '}
          <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> or use the{' '}
          <Link href="/support">support page</Link>.
        </p>
      </RoomSection>
    </>
  );
}

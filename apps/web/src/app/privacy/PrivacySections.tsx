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
import './privacy.css';

void React;

const PAGE_SECTIONS = [
  { id: 'scope', label: 'Scope' },
  { id: 'web', label: 'Website' },
  { id: 'not-collected', label: 'Not collected' },
  { id: 'location', label: 'Location' },
  { id: 'integrity', label: 'Abuse checks' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'changes', label: 'Changes' },
] as const;

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
      <nav className="ds-privacy__nav" aria-labelledby="privacy-toc-title">
        <p className="ds-privacy__nav-title" id="privacy-toc-title">
          On this page
        </p>
        <ul className="ds-privacy__nav-list">
          {PAGE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-privacy__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ds-entity-sections">
        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="privacy-scope"
          id="scope"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Who this covers
          </p>
          <h2 className="ds-section__title" id="privacy-scope">
            BlackStory public website
          </h2>
          <p className="ds-section__lede">
            This policy describes how BlackStory handles information on{' '}
            <span className="ds-phrase-nowrap">blackstory.app</span>. It covers what the site does
            now. It is not a promise about features that do not exist yet.
          </p>
          <p className="ds-privacy__follow">
            Data controller: <strong>Gerald Dagher</strong> (individual).
          </p>
          <p className="ds-privacy__meta">Last updated: August 2026</p>
        </section>

        <section className="ds-section ds-record-section" aria-labelledby="privacy-web" id="web">
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Website
          </p>
          <h2 className="ds-section__title" id="privacy-web">
            What this site may process
          </h2>
          <p className="ds-section__lede">
            The public website is read-first. Interactive flows are optional and labeled before you
            use them.
          </p>
          <InventoryLedger items={WEB_INVENTORY} label="Website data inventory" />
          <p className="ds-privacy__follow">
            For how published records are verified and corrected, see{' '}
            <Link href="/methodology">methodology</Link> and the{' '}
            <Link href="/corrections">corrections lane</Link>.
          </p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="privacy-not-collected"
          id="not-collected"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Explicit limits
          </p>
          <h2 className="ds-section__title" id="privacy-not-collected">
            What I do not collect
          </h2>
          <p className="ds-section__lede">
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
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="privacy-location"
          id="location"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Optional location
          </p>
          <h2 className="ds-section__title" id="privacy-location">
            Location is never required
          </h2>
          <p className="ds-section__lede">
            Location lookup starts only after you press a labeled control; the page never requests
            device location automatically. You can always browse by state or search by place name
            instead.
          </p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="privacy-integrity"
          id="integrity"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Abuse protection
          </p>
          <h2 className="ds-section__title" id="privacy-integrity">
            What the abuse checks look at
          </h2>
          <p className="ds-section__lede">
            Pages that could be hit at scale (search, corrections, lead submission) sit behind rate
            limits and same-origin checks. Nothing those checks record is used to build a marketing
            profile.
          </p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="privacy-corrections"
          id="corrections"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Submissions
          </p>
          <h2 className="ds-section__title" id="privacy-corrections">
            Corrections and leads
          </h2>
          <p className="ds-section__lede">
            When you file a correction, appeal, abuse report, or research lead, you choose what to
            write. Submissions enter a restricted quarantine queue and are never published as
            submitted. The optional contact fields are used only to follow up with you about that
            submission, and they are never shown publicly.
          </p>
          <p className="ds-privacy__follow">
            Read the corrections privacy notice on the{' '}
            <Link href="/corrections">corrections page</Link> before submitting. Do not include
            anyone&apos;s home address or other sensitive personal details about a living person
            unless strictly necessary for the correction.
          </p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="privacy-changes"
          id="changes"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Updates
          </p>
          <h2 className="ds-section__title" id="privacy-changes">
            Changes and contact
          </h2>
          <p className="ds-section__lede">
            A material change to this policy is posted here, with a new date at the top. For a
            privacy request, or a question about how any of this runs, write to{' '}
            <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a> or use the{' '}
            <Link href="/support">support page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * Privacy policy page sections: scope, web and mobile inventories, explicit non-collection
 * rules, optional location, client integrity, corrections intake, and owner placeholders.
 */
import React from 'react';
import Link from 'next/link';
import './privacy.css';

void React;

const PAGE_SECTIONS = [
  { id: 'scope', label: 'Scope' },
  { id: 'web', label: 'Website' },
  { id: 'mobile', label: 'Mobile app' },
  { id: 'not-collected', label: 'Not collected' },
  { id: 'location', label: 'Location' },
  { id: 'integrity', label: 'Client integrity' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'changes', label: 'Changes' },
] as const;

const WEB_INVENTORY = [
  {
    id: 'reading',
    term: 'Public reading',
    definition:
      'Browsing maps, records, stories, and trust pages does not require an account. We do not ask you to sign in to read published projections.',
  },
  {
    id: 'integrity',
    term: 'Request integrity',
    definition:
      'Some interactive features (search refine, geocode lookup, corrections, and lead submission) use a same-origin request-integrity token paired with an HttpOnly cookie. This is CSRF and origin protection — not advertising, not cross-site tracking, and not Firebase App Check.',
  },
  {
    id: 'location',
    term: 'Optional location lookup',
    definition:
      'If you choose to share device location or enter an address or ZIP on the map or locate flows, that input is sent to the U.S. Census Bureau public geocoder to resolve state, county, and (when applicable) city. Exact coordinates and typed addresses are discarded after resolution — they are not kept as a search history.',
  },
  {
    id: 'hosting',
    term: 'Standard hosting logs',
    definition:
      'Like most websites, infrastructure may record IP address, user agent, request path, and timestamps in server logs for security and reliability. These logs are operational — not sold, not used for ad targeting, and not linked to an account because there is none.',
  },
] as const;

const MOBILE_INVENTORY = [
  {
    id: 'client-header',
    term: 'Client identification header',
    definition:
      'Every API request from the native app carries an X-BlackStory-Client header with app version and API major version. The server validates this against a Postgres-backed client registry. There is no Firebase App Check token and no attestation JWT in logs.',
  },
  {
    id: 'media',
    term: 'Public media',
    definition:
      'The app fetches already-public media URLs for rendering and caches them on device. No ad network, no attribution SDK, and no session replay.',
  },
  {
    id: 'device',
    term: 'Coarse device metadata',
    definition:
      'Device model and OS version may appear in request metadata for compatibility. The app declares no iOS permission usage strings and no Android runtime permissions beyond baseline internet access at launch.',
  },
  {
    id: 'observability',
    term: 'Developer observability only',
    definition:
      'Crash and performance signals go to the developer console in __DEV__ builds only, with values redacted before logging. There is no remote crash SDK and no user-behavior analytics product linked in production builds.',
  },
] as const;

const NOT_COLLECTED_RULES = [
  'No user accounts at launch — on web or in the mobile app.',
  'No advertising SDKs, no ad identifiers (IDFA/GAID), and no App Tracking Transparency prompt because nothing tracks.',
  'No general analytics or attribution SDKs beyond privacy-safe, redacted developer diagnostics.',
  'No push notifications, social sign-in, contacts access, camera, microphone, or background location at mobile launch.',
  'No sale of personal information and no cross-context behavioral advertising.',
] as const;

function InventoryLedger({
  items,
  label,
}: {
  readonly items: readonly { readonly id: string; readonly term: string; readonly definition: string }[];
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
            BlackStory public surfaces
          </h2>
          <p className="ds-section__lede">
            This policy describes how BlackStory handles information on{' '}
            <span className="ds-phrase-nowrap">blackbook.app</span> and in the BlackStory native
            reader for iOS and Android. It is an honest inventory — not a completeness claim about
            every future feature.
          </p>
          <p className="ds-privacy__follow">
            Data controller: <strong>[Legal entity — owner]</strong>. The legal entity that signs
            store developer agreements must match the name published here before public app store
            submission.
          </p>
          <p className="ds-privacy__meta">Last updated: July 2026</p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="privacy-web"
          id="web"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Website
          </p>
          <h2 className="ds-section__title" id="privacy-web">
            What the web app may process
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
          aria-labelledby="privacy-mobile"
          id="mobile"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Mobile app
          </p>
          <h2 className="ds-section__title" id="privacy-mobile">
            What the native reader may process
          </h2>
          <p className="ds-section__lede">
            At launch the mobile app is a reader for the same public projections — no accounts, no
            push, and no background location. The inventory below matches the mobile privacy review
            documented in the repository.
          </p>
          <InventoryLedger items={MOBILE_INVENTORY} label="Mobile app data inventory" />
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
            What we do not collect or use
          </h2>
          <p className="ds-section__lede">
            These are product rules, not marketing language. If a future release adds a capability
            listed here, this page will be updated before it ships.
          </p>
          <ol className="ds-privacy__rule-strip" aria-label="Data we do not collect">
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
            On the website, location lookup starts only after you press a labeled control — the
            page never requests device location automatically. You can always browse by state,
            search by place name, or enter an address manually instead.
          </p>
          <p className="ds-privacy__follow">
            The mobile app at launch does not request location permissions. Map and record reading
            work without sharing where you are.
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
            Client integrity, not tracking
          </h2>
          <p className="ds-section__lede">
            Public APIs that could be abused at scale sit behind rate limits and client integrity
            checks. On the web, integrity uses same-origin tokens. In the mobile app, integrity
            uses the X-BlackStory-Client header validated server-side. Neither mechanism builds a
            marketing profile.
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
            write. Submissions enter a restricted quarantine queue — they are never published as
            submitted. Optional contact fields are for moderator follow-up only and are not shown
            publicly.
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
            Material changes to this policy will be posted on this page with an updated date. For
            product questions or privacy requests, contact{' '}
            <strong>[Support contact — owner to set]</strong> or use the{' '}
            <Link href="/support">support page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

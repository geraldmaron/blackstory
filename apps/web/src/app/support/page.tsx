/**
 * Public support page for BlackStory store gates. Primary path is the corrections lane;
 * secondary trust surfaces and a contact placeholder until the owner sets a live address.
 */
import Link from 'next/link';
import './support.css';

export const metadata = {
  title: 'Support',
  description:
    'How to report corrections, read BlackStory trust documentation, and reach the team.',
};

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
    <main className="ds-container ds-page ds-support" id="main">
      <p className="ds-page__eyebrow">Help</p>
      <h1 className="ds-page__title">Support</h1>
      <p className="ds-page__lede">
        BlackStory is a place-connected research archive. The fastest path for factual issues is the
        corrections lane — moderated, receipted, and never published as submitted.
      </p>

      <div className="ds-entity-sections">
        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="support-paths"
          id="paths"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Start here
          </p>
          <h2 className="ds-section__title" id="support-paths">
            Common paths
          </h2>
          <p className="ds-section__lede">
            Most questions about a specific record are best handled through corrections so moderators
            can tie your report to the published projection and sources.
          </p>
          <ul className="ds-support__paths">
            {SUPPORT_PATHS.map((path) => (
              <li key={path.href} className="ds-support__path">
                <Link className="ds-support__path-link" href={path.href}>
                  <span className="ds-support__path-label">{path.label}</span>
                  <span className="ds-support__path-detail">{path.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="support-contact"
          id="contact"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Direct contact
          </p>
          <h2 className="ds-section__title" id="support-contact">
            Reach the team
          </h2>
          <p className="ds-section__lede">
            For issues that do not fit the corrections form — account of operation questions, privacy
            requests, or accessibility barriers — use the contact below once the owner publishes it.
          </p>
          <div className="ds-support__contact">
            <p className="ds-support__contact-label">Support contact</p>
            <p className="ds-support__contact-value">
              <strong>[Support contact — owner to set]</strong>
            </p>
          </div>
          <p className="ds-support__follow">
            Privacy questions: see the <Link href="/privacy">privacy policy</Link>. Store listings
            link here and to that policy; both URLs must be live on{' '}
            <span className="ds-phrase-nowrap">blackbook.app</span> before app store submission.
          </p>
        </section>
      </div>
    </main>
  );
}

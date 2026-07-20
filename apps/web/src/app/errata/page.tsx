/**
 * Public errata log reverse-chronological corrections policy and change history with
 * four-way taxonomy. Companion feeds at /errata/feed.json and /errata/feed.xml.
 */
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { ERRATA_CHANGE_TYPE_LABELS } from '../../lib/trust/domain-trust';
import { listErrataEntries } from '../../lib/trust/errata-seed';
import { TRUST_PATHS } from '../../lib/trust/site-identity';

export const metadata = {
  title: 'Errata & corrections policy',
  description:
    'Reverse-chronological log of corrections, clarifications, updates, and editor notes — fully, quickly, and without defensiveness.',
};

function formatDate(timestamp: string): string {
  return timestamp.split('T')[0] ?? timestamp;
}

export default function ErrataPage() {
  const entries = listErrataEntries();

  return (
    <main className="ds-container ds-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.errata} pageTitle="Errata" />
      <p className="ds-page__eyebrow">Corrections</p>
      <h1 className="ds-page__title">Errata log</h1>
      <p className="ds-page__lede">
        Errors are fixed fully, quickly, and ungrudgingly. Every change is timestamped, categorized,
        and preserved — nothing is silently edited.
      </p>

      <section
        className="ds-section"
        aria-labelledby="errata-policy"
        id="policy"
        style={{ paddingTop: 0 }}
      >
        <h2 className="ds-section__title" id="errata-policy">
          Corrections policy
        </h2>
        <p className="ds-section__lede">
          We use a four-way taxonomy: <strong>correction</strong> (a factual error fixed),{' '}
          <strong>clarification</strong> (wording sharpened without changing the fact),{' '}
          <strong>update</strong> (new evidence added or status changed), and{' '}
          <strong>editor&apos;s note</strong> (editorial framing only). Corrected facts also carry
          schema.org <span className="ds-mono">CorrectionComment</span> markup on their record
          pages.
        </p>
        <p className="ds-sans">
          Report a new issue through the <a href="/corrections">corrections lane</a>. Subscribe via{' '}
          <a href="/errata/feed.json">JSON Feed</a> or <a href="/errata/feed.xml">RSS</a>.
        </p>
      </section>

      <section className="ds-section" aria-labelledby="errata-log">
        <h2 className="ds-section__title" id="errata-log">
          Change log
        </h2>
        {entries.length === 0 ? (
          <p className="ds-sans">No errata entries have been published yet.</p>
        ) : (
          <ol className="ds-sans" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  marginBottom: 'var(--ds-space-6)',
                  paddingBottom: 'var(--ds-space-4)',
                  borderBottom: 'var(--ds-border-width) solid var(--ds-border)',
                }}
              >
                <p style={{ margin: 0, color: 'var(--ds-ink-muted)' }}>
                  <time dateTime={entry.timestamp}>{formatDate(entry.timestamp)}</time>
                  {' · '}
                  <span className="ds-mono">{ERRATA_CHANGE_TYPE_LABELS[entry.changeType]}</span>
                </p>
                <h3 className="ds-subheading" style={{ margin: 'var(--ds-space-2) 0' }}>
                  {entry.headline}
                </h3>
                <p style={{ margin: 0 }}>{entry.summary}</p>
                {entry.affectedUrl ? (
                  <p style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
                    <a href={entry.affectedUrl}>Affected record</a>
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

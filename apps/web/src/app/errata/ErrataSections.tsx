/**
 * Errata page sections: corrections policy taxonomy, reverse-chronological change log,
 * feed subscriptions, and compact footer links — matching methodology delivery patterns.
 */
import React from 'react';
import Link from 'next/link';
import { ERRATA_CHANGE_TYPE_LABELS, type ErrataChangeType } from '../../lib/trust/domain-trust';
import type { ErrataEntry } from '../../lib/trust/errata-seed';
import './errata.css';

const PAGE_SECTIONS = [
  { id: 'policy', label: 'Policy' },
  { id: 'changelog', label: 'Change log' },
  { id: 'feeds', label: 'Feeds' },
] as const;

const TAXONOMY_ITEMS: readonly {
  readonly id: ErrataChangeType;
  readonly term: string;
  readonly definition: string;
}[] = [
  {
    id: 'correction',
    term: 'Correction',
    definition: 'A factual error fixed in the public record.',
  },
  {
    id: 'clarification',
    term: 'Clarification',
    definition: 'Wording sharpened without changing the underlying fact.',
  },
  {
    id: 'update',
    term: 'Update',
    definition: 'New evidence added or record status changed.',
  },
  {
    id: 'editors_note',
    term: "Editor's note",
    definition: 'Editorial framing or methodology change — not a fact correction.',
  },
];

function formatDate(timestamp: string): string {
  return timestamp.split('T')[0] ?? timestamp;
}

function TaxonomyLedger() {
  return (
    <div className="ds-errata__ledger">
      {TAXONOMY_ITEMS.map((item) => (
        <article key={item.id} className="ds-errata__ledger-item">
          <div className="ds-errata__ledger-head">
            <span className="ds-errata__chip">{item.term}</span>
          </div>
          <p className="ds-errata__ledger-summary">{item.definition}</p>
        </article>
      ))}
    </div>
  );
}

function ChangeLog({ entries }: { readonly entries: readonly ErrataEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="ds-errata__empty" role="status">
        No errata entries have been published yet.
      </p>
    );
  }

  return (
    <ol className="ds-errata__log" aria-label="Errata change log">
      {entries.map((entry) => (
        <li key={entry.id} className="ds-errata__log-item">
          <div className="ds-errata__ledger-head">
            <span className="ds-errata__chip">{ERRATA_CHANGE_TYPE_LABELS[entry.changeType]}</span>
            <time className="ds-errata__ledger-meta" dateTime={entry.timestamp}>
              {formatDate(entry.timestamp)}
            </time>
          </div>
          <h3 className="ds-errata__ledger-title">{entry.headline}</h3>
          <p className="ds-errata__ledger-summary">{entry.summary}</p>
          {entry.affectedUrl ? (
            <p className="ds-errata__ledger-link">
              <Link href={entry.affectedUrl}>Affected record</Link>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ErrataSections({ entries }: { readonly entries: readonly ErrataEntry[] }) {
  return (
    <div className="ds-errata">
      <nav className="ds-errata__nav" aria-labelledby="errata-toc-title">
        <p className="ds-errata__nav-title" id="errata-toc-title">
          On this page
        </p>
        <ul className="ds-errata__nav-list">
          {PAGE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-errata__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ds-entity-sections">
        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="errata-policy"
          id="policy"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Corrections policy
          </p>
          <h2 className="ds-section__title" id="errata-policy">
            Four-way taxonomy
          </h2>
          <p className="ds-section__lede">
            Errors are fixed fully, quickly, and ungrudgingly. Every change is timestamped,
            categorized, and preserved — nothing is silently edited. Corrected facts also carry
            schema.org <span className="ds-mono">CorrectionComment</span> markup on their record
            pages.
          </p>
          <TaxonomyLedger />
          <p className="ds-errata__policy-link">
            Report a new issue through the{' '}
            <Link href="/corrections">corrections lane</Link>.
          </p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="errata-log"
          id="changelog"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Published changes
          </p>
          <h2 className="ds-section__title" id="errata-log">
            Change log
          </h2>
          <p className="ds-section__lede">
            Reverse-chronological record of corrections, clarifications, updates, and editor notes
            applied to the public archive.
          </p>
          <ChangeLog entries={entries} />
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="errata-feeds"
          id="feeds"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Subscribe
          </p>
          <h2 className="ds-section__title" id="errata-feeds">
            Feed subscriptions
          </h2>
          <div className="ds-errata__feeds">
            <p className="ds-errata__feeds-kicker">Stay current</p>
            <p className="ds-errata__feeds-body">
              Follow errata updates via{' '}
              <Link href="/errata/feed.json">JSON Feed</Link> or{' '}
              <Link href="/errata/feed.xml">RSS</Link>. Feeds include change type, headline, and
              summary for each entry.
            </p>
          </div>
        </section>
      </div>

      <section className="ds-section ds-errata__next" aria-labelledby="next-errata" id="next">
        <h2 className="ds-section__title" id="next-errata">
          Keep going
        </h2>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/corrections">
            Corrections
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/">
            Open the map
          </Link>
        </p>
      </section>
    </div>
  );
}

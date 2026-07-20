/**
 * Law detail page sections: on-page nav, explainer body, and provenance block.
 */
import React from 'react';
import Link from 'next/link';
import { Card } from '@repo/ui';
import type { LegalPlainLanguageExplainer } from '@repo/domain';
import type { SEED_LEGAL_SNAPSHOTS } from '../../data/legal-seed';
import {
  LegalDisclaimer,
  LegalExplainerSections,
  LegalStatusBadge,
  humanizeLegalKind,
} from '../../components/legal';
import './law.css';

const DETAIL_SECTIONS = [
  { id: 'what-it-says', label: 'What it says' },
  { id: 'what-it-means', label: 'What it means' },
  { id: 'why-it-matters', label: 'Why it matters' },
  { id: 'rights-today', label: 'Your rights today' },
  { id: 'primary-sources', label: 'Primary sources' },
  { id: 'provenance', label: 'Provenance' },
] as const;

export type LawDetailSectionsProps = {
  readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
  readonly explainer?: LegalPlainLanguageExplainer;
};

export function LawDetailSections({ snapshot, explainer }: LawDetailSectionsProps) {
  const statusBadge = <LegalStatusBadge status={snapshot.lawStatus} />;

  return (
    <div className="ds-law">
      <LegalDisclaimer />

      {explainer ? (
        <nav className="ds-law__nav" aria-labelledby="law-detail-toc-title">
          <p className="ds-law__nav-title" id="law-detail-toc-title">
            On this page
          </p>
          <ul className="ds-law__nav-list">
            {DETAIL_SECTIONS.map((section) => (
              <li key={section.id}>
                <a className="ds-law__nav-link" href={`#${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {explainer ? (
        <LegalExplainerSections
          explainer={explainer}
          citation={snapshot.citation.canonicalCitation}
          statusBadge={statusBadge}
        />
      ) : (
        <section className="ds-section ds-record-section" aria-labelledby="pending-explainer">
          <Card>
            <h2 className="ds-section__title" id="pending-explainer">
              Plain-language explainer pending
            </h2>
            <p style={{ margin: 'var(--ds-space-3) 0 0 0' }}>
              Editorial review is in progress. Primary source:{' '}
              <a
                href={snapshot.citation.archive.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {snapshot.citation.archive.sourceUrl}
              </a>
            </p>
          </Card>
        </section>
      )}

      <section
        className="ds-section ds-record-section"
        aria-labelledby="provenance-heading"
        id="provenance"
      >
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          {humanizeLegalKind(snapshot.kind)} ·{' '}
          <span className="ds-mono">{snapshot.jurisdictionId}</span>
        </p>
        <h2 className="ds-section__title" id="provenance-heading">
          Archived capture
        </h2>
        <article className="ds-law__section-card">
          <dl className="ds-law__provenance-dl">
            <div className="ds-law__provenance-row">
              <dt>Retrieved</dt>
              <dd>{snapshot.citation.archive.retrievedAt.split('T')[0]}</dd>
            </div>
            <div className="ds-law__provenance-row">
              <dt>License</dt>
              <dd>{snapshot.citation.licenseTag}</dd>
            </div>
            <div className="ds-law__provenance-row">
              <dt>Archived copy</dt>
              <dd>
                <a
                  href={snapshot.citation.archive.archivedCaptureUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View archived capture
                </a>
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="ds-section ds-law__next" aria-labelledby="law-detail-next">
        <h2 className="ds-section__title" id="law-detail-next">
          Keep going
        </h2>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/law">
            All law entries
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/search">
            Search the archive
          </Link>
        </p>
      </section>
    </div>
  );
}

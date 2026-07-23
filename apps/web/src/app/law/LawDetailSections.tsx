/**
 * Law detail page sections: anatomy strip, explainer body, provenance, and depart links.
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
import { LawAnatomyStrip } from './LawAnatomyStrip';
import { lawEditionPanelClassName } from './law-panel-chrome';

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
  return (
    <>
      <article className={lawEditionPanelClassName('disclaimer')}>
        <LegalDisclaimer />
      </article>

      {explainer ? (
        <nav
          className={`${lawEditionPanelClassName()} ds-law-edition__nav`}
          aria-labelledby="law-detail-toc-title"
        >
          <p className="ds-law-edition__nav-title" id="law-detail-toc-title">
            On this page
          </p>
          <ul className="ds-law-edition__nav-list">
            {DETAIL_SECTIONS.map((section) => (
              <li key={section.id}>
                <a className="ds-law-edition__nav-link" href={`#${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {explainer ? (
        <article className={lawEditionPanelClassName('explainer')} aria-labelledby="explainer-heading">
          <p className="ds-law-edition__panel-title">Explainer</p>
          <h2 className="ds-law-edition__panel-heading" id="explainer-heading">
            Plain-language sections
          </h2>
          <LegalExplainerSections
            explainer={explainer}
            citation={snapshot.citation.canonicalCitation}
            statusBadge={<LegalStatusBadge status={snapshot.lawStatus} />}
          />
        </article>
      ) : (
        <article className={lawEditionPanelClassName('explainer')} aria-labelledby="pending-explainer">
          <Card>
            <h2 className="ds-law-edition__panel-heading" id="pending-explainer">
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
        </article>
      )}

      <article
        className={lawEditionPanelClassName('provenance')}
        aria-labelledby="provenance-heading"
        id="provenance"
      >
        <p className="ds-law-edition__panel-title">Provenance</p>
        <h2 className="ds-law-edition__panel-heading" id="provenance-heading">
          Archived capture
        </h2>
        <p className="ds-law-edition__lede">
          {humanizeLegalKind(snapshot.kind)} ·{' '}
          <span className="ds-mono">{snapshot.jurisdictionId}</span>
        </p>
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

      <article className={lawEditionPanelClassName('close')} aria-labelledby="law-detail-next">
        <h2 className="ds-law-edition__panel-heading" id="law-detail-next">
          Keep going
        </h2>
        <p className="ds-law-edition__footer-links">
          <Link className="ds-cta-link" href="/law">
            All law entries
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/history">
            Search the archive
          </Link>
        </p>
      </article>
    </>
  );
}

export type LawDetailIntroProps = {
  readonly snapshot: (typeof SEED_LEGAL_SNAPSHOTS)[number];
};

export function LawDetailIntro({ snapshot }: LawDetailIntroProps) {
  return (
    <article className={lawEditionPanelClassName('intro')}>
      <header className="ds-law-edition__header">
        <span className="ds-law-edition__index" aria-hidden="true">
          00
        </span>
        <div>
          <p className="ds-law-edition__kicker">Reference</p>
          <h1 className="ds-law-edition__title">{snapshot.title}</h1>
          <LawAnatomyStrip
            kind={snapshot.kind}
            lawStatus={snapshot.lawStatus}
            jurisdictionId={snapshot.jurisdictionId}
            citation={snapshot.citation.canonicalCitation}
            topics={snapshot.topics}
          />
          <p className="ds-law-edition__credit">
            Archive mosaic · symbolic atmosphere · decorative gutter tiles only.{' '}
            <Link href="/stories/mosaic-credits">Mosaic credits</Link>
          </p>
        </div>
      </header>
    </article>
  );
}

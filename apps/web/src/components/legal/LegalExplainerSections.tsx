/**
 * Five-section plain-language explainer layout for legal detail pages.
 */
import React from 'react';
import { Card } from '@black-book/ui';
import type { LegalPlainLanguageExplainer } from '../../../../../packages/domain/src/legal/index.js';
import { LEGAL_SECTION_LABELS } from './copy';
import { formatReviewDate } from './format';

export type LegalExplainerSectionsProps = {
  readonly explainer: LegalPlainLanguageExplainer;
  readonly citation: string;
  readonly statusBadge: React.ReactNode;
};

export function LegalExplainerSections({ explainer, citation, statusBadge }: LegalExplainerSectionsProps) {
  return (
    <div className="bb-stack">
      <p className="bb-sans" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bb-ink-muted)' }}>
        Reviewed {formatReviewDate(explainer.reviewedAt)} · {citation} · {statusBadge}
      </p>

      <Card>
        <h2 className="bb-section__title" id="legal-what-it-says">
          {LEGAL_SECTION_LABELS.whatItSays}
        </h2>
        <p style={{ margin: 'var(--bb-space-3) 0 0 0' }}>{explainer.whatItSays}</p>
      </Card>

      <Card>
        <h2 className="bb-section__title" id="legal-what-it-means">
          {LEGAL_SECTION_LABELS.whatItMeans}
        </h2>
        <div className="bb-stack" style={{ marginTop: 'var(--bb-space-3)' }}>
          {explainer.whatItMeans.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
        {explainer.termOfArtLinks && explainer.termOfArtLinks.length > 0 ? (
          <nav aria-label="Terms of art" style={{ marginTop: 'var(--bb-space-4)' }}>
            <p className="bb-section__kicker">Terms of art</p>
            <ul className="bb-list">
              {explainer.termOfArtLinks.map((link) => (
                <li key={link.term}>
                  <a href={link.wexUrl} rel="noopener noreferrer" target="_blank">
                    {link.term}
                  </a>{' '}
                  (Cornell Wex)
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </Card>

      <Card>
        <h2 className="bb-section__title" id="legal-why-it-matters">
          {LEGAL_SECTION_LABELS.whyItMatters}
        </h2>
        <div className="bb-stack" style={{ marginTop: 'var(--bb-space-3)' }}>
          {explainer.whyItMatters.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="bb-section__title" id="legal-rights-today">
          {LEGAL_SECTION_LABELS.rightsToday}
        </h2>
        {explainer.rightsToday.length > 0 ? (
          <ul className="bb-list" style={{ marginTop: 'var(--bb-space-3)' }}>
            {explainer.rightsToday.map((bullet) => (
              <li key={bullet.label}>
                <a href={bullet.agencyUrl} rel="noopener noreferrer" target="_blank">
                  {bullet.label}
                </a>
                {bullet.note ? <span> — {bullet.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 'var(--bb-space-3) 0 0 0' }}>
            Consult official agency resources linked in Primary sources below.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="bb-section__title" id="legal-primary-sources">
          {LEGAL_SECTION_LABELS.primarySources}
        </h2>
        <ul className="bb-list" style={{ marginTop: 'var(--bb-space-3)' }}>
          {explainer.primarySources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener noreferrer" target="_blank">
                {source.label}
              </a>
              <span className="bb-mono" style={{ marginLeft: 'var(--bb-space-2)' }}>
                ({source.licenseTag})
              </span>
              {source.archivedUrl ? (
                <>
                  {' '}
                  ·{' '}
                  <a href={source.archivedUrl} rel="noopener noreferrer" target="_blank">
                    Archived copy
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

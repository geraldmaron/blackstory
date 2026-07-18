/**
 * Five-section plain-language explainer layout for legal detail pages.
 */
import React from 'react';
import { Card } from '@blap/ui';
import type { LegalPlainLanguageExplainer } from '@blap/domain';
import { LEGAL_SECTION_LABELS } from './copy';
import { formatReviewDate } from './format';

export type LegalExplainerSectionsProps = {
  readonly explainer: LegalPlainLanguageExplainer;
  readonly citation: string;
  readonly statusBadge: React.ReactNode;
};

export function LegalExplainerSections({ explainer, citation, statusBadge }: LegalExplainerSectionsProps) {
  return (
    <div className="bp-stack">
      <p className="bp-sans" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bp-ink-muted)' }}>
        Reviewed {formatReviewDate(explainer.reviewedAt)} · {citation} · {statusBadge}
      </p>

      <Card>
        <h2 className="bp-section__title" id="legal-what-it-says">
          {LEGAL_SECTION_LABELS.whatItSays}
        </h2>
        <p style={{ margin: 'var(--bp-space-3) 0 0 0' }}>{explainer.whatItSays}</p>
      </Card>

      <Card>
        <h2 className="bp-section__title" id="legal-what-it-means">
          {LEGAL_SECTION_LABELS.whatItMeans}
        </h2>
        <div className="bp-stack" style={{ marginTop: 'var(--bp-space-3)' }}>
          {explainer.whatItMeans.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
        {explainer.termOfArtLinks && explainer.termOfArtLinks.length > 0 ? (
          <nav aria-label="Terms of art" style={{ marginTop: 'var(--bp-space-4)' }}>
            <p className="bp-section__kicker">Terms of art</p>
            <ul className="bp-list">
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
        <h2 className="bp-section__title" id="legal-why-it-matters">
          {LEGAL_SECTION_LABELS.whyItMatters}
        </h2>
        <div className="bp-stack" style={{ marginTop: 'var(--bp-space-3)' }}>
          {explainer.whyItMatters.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="bp-section__title" id="legal-rights-today">
          {LEGAL_SECTION_LABELS.rightsToday}
        </h2>
        {explainer.rightsToday.length > 0 ? (
          <ul className="bp-list" style={{ marginTop: 'var(--bp-space-3)' }}>
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
          <p style={{ margin: 'var(--bp-space-3) 0 0 0' }}>
            Consult official agency resources linked in Primary sources below.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="bp-section__title" id="legal-primary-sources">
          {LEGAL_SECTION_LABELS.primarySources}
        </h2>
        <ul className="bp-list" style={{ marginTop: 'var(--bp-space-3)' }}>
          {explainer.primarySources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener noreferrer" target="_blank">
                {source.label}
              </a>
              <span className="bp-mono" style={{ marginLeft: 'var(--bp-space-2)' }}>
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

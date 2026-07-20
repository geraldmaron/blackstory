/**
 * Five-section plain-language explainer layout for law detail pages.
 */
import React from 'react';
import type { LegalPlainLanguageExplainer } from '@repo/domain';
import { LEGAL_SECTION_LABELS } from './copy';
import { formatReviewDate } from './format';

export type LegalExplainerSectionsProps = {
  readonly explainer: LegalPlainLanguageExplainer;
  readonly citation: string;
  readonly statusBadge: React.ReactNode;
};

export function LegalExplainerSections({
  explainer,
  citation,
  statusBadge,
}: LegalExplainerSectionsProps) {
  return (
    <div className="ds-law__explainer-stack">
      <p className="ds-law__review-line">
        Reviewed {formatReviewDate(explainer.reviewedAt)} · {citation} · {statusBadge}
      </p>

      <article className="ds-law__section-card" id="what-it-says">
        <h2 className="ds-law__section-title">{LEGAL_SECTION_LABELS.whatItSays}</h2>
        <div className="ds-law__section-body">
          <p>{explainer.whatItSays}</p>
        </div>
      </article>

      <article className="ds-law__section-card" id="what-it-means">
        <h2 className="ds-law__section-title">{LEGAL_SECTION_LABELS.whatItMeans}</h2>
        <div className="ds-law__section-body">
          {explainer.whatItMeans.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
        {explainer.termOfArtLinks && explainer.termOfArtLinks.length > 0 ? (
          <nav className="ds-law__terms-nav" aria-label="Terms of art">
            <p className="ds-law__terms-kicker">Terms of art</p>
            <ul className="ds-law__section-list">
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
      </article>

      <article className="ds-law__section-card" id="why-it-matters">
        <h2 className="ds-law__section-title">{LEGAL_SECTION_LABELS.whyItMatters}</h2>
        <div className="ds-law__section-body">
          {explainer.whyItMatters.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
      </article>

      <article className="ds-law__section-card" id="rights-today">
        <h2 className="ds-law__section-title">{LEGAL_SECTION_LABELS.rightsToday}</h2>
        {explainer.rightsToday.length > 0 ? (
          <ul className="ds-law__section-list">
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
          <p className="ds-law__section-body">
            Consult official agency resources linked in Primary sources below.
          </p>
        )}
      </article>

      <article className="ds-law__section-card" id="primary-sources">
        <h2 className="ds-law__section-title">{LEGAL_SECTION_LABELS.primarySources}</h2>
        <ul className="ds-law__section-list">
          {explainer.primarySources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener noreferrer" target="_blank">
                {source.label}
              </a>
              <span className="ds-mono" style={{ marginLeft: 'var(--ds-space-2)' }}>
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
      </article>
    </div>
  );
}

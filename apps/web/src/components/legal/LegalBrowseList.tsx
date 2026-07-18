/**
 * Browse list row for the `/legal` index page.
 */
import React from 'react';
import type { LawStatus } from '@repo/domain/entity-status';
import { LegalStatusBadge } from './LegalStatusBadge';
import { humanizeLegalKind, humanizeLegalTopic } from './format';

export type LegalBrowseItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: string;
  readonly citation: string;
  readonly lawStatus: LawStatus;
  readonly topics: readonly string[];
  readonly hasExplainer: boolean;
  readonly factHref?: string;
};

export type LegalBrowseListProps = {
  readonly items: readonly LegalBrowseItem[];
  readonly labelledBy: string;
};

export function LegalBrowseList({ items, labelledBy }: LegalBrowseListProps) {
  return (
    <ul className="ds-result-list ds-legal-browse-list" aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="ds-result-list__item ds-legal-browse-list__item">
          <article className="ds-legal-browse-list__record">
            <h3 className="ds-result-list__title" style={{ margin: 0 }}>
              <a href={`/legal/${item.slug}`}>{item.title}</a>
            </h3>
            <p className="ds-result-list__summary" style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
              <span className="ds-mono">{item.citation}</span>
            </p>
            <div className="ds-row" style={{ marginTop: 'var(--ds-space-2)', gap: 'var(--ds-space-2)', flexWrap: 'wrap' }}>
              <span className="ds-sans">{humanizeLegalKind(item.kind)}</span>
              <LegalStatusBadge status={item.lawStatus} />
              {item.topics.map((topic) => (
                <span key={topic} className="ds-badge">
                  {humanizeLegalTopic(topic)}
                </span>
              ))}
              {item.hasExplainer ? (
                <span className="ds-sans">Plain-language explainer available</span>
              ) : null}
            </div>
            {item.factHref ? (
              <p style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
                <a href={item.factHref}>View canonical fact record</a>
              </p>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

/**
 * Browse list row for the `/legal` index page.
 */
import React from 'react';
import type { LawStatus } from '@blap/domain';
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
    <ul className="bp-result-list" aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="bp-result-list__item">
          <article>
            <h3 className="bp-result-list__title" style={{ margin: 0 }}>
              <a href={`/legal/${item.slug}`}>{item.title}</a>
            </h3>
            <p className="bp-result-list__summary" style={{ margin: 'var(--bp-space-2) 0 0 0' }}>
              <span className="bp-mono">{item.citation}</span>
            </p>
            <div className="bp-row" style={{ marginTop: 'var(--bp-space-2)', gap: 'var(--bp-space-2)', flexWrap: 'wrap' }}>
              <span className="bp-sans">{humanizeLegalKind(item.kind)}</span>
              <LegalStatusBadge status={item.lawStatus} />
              {item.topics.map((topic) => (
                <span key={topic} className="bp-badge">
                  {humanizeLegalTopic(topic)}
                </span>
              ))}
              {item.hasExplainer ? (
                <span className="bp-sans">Plain-language explainer available</span>
              ) : null}
            </div>
            {item.factHref ? (
              <p style={{ margin: 'var(--bp-space-2) 0 0 0' }}>
                <a href={item.factHref}>View canonical fact record</a>
              </p>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

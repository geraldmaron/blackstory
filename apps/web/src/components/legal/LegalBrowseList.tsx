/**
 * Browse ledger rows for the `/law` index page.
 * Uses Next.js `Link` for soft in-app transitions.
 */
import React from 'react';
import Link from 'next/link';
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
};

export type LegalBrowseListProps = {
  readonly items: readonly LegalBrowseItem[];
  readonly labelledBy: string;
};

export function LegalBrowseList({ items, labelledBy }: LegalBrowseListProps) {
  return (
    <ul className="ds-law__browse-ledger" aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="ds-law__browse-item">
          <article>
            <div className="ds-law__browse-head">
              <h3 className="ds-law__browse-title">
                <Link href={`/law/${item.slug}`}>{item.title}</Link>
              </h3>
              <LegalStatusBadge status={item.lawStatus} />
            </div>
            <p className="ds-law__browse-citation">{item.citation}</p>
            <div className="ds-law__browse-meta">
              <span className="ds-law__chip">{humanizeLegalKind(item.kind)}</span>
              {item.topics.map((topic) => (
                <span key={topic} className="ds-law__chip ds-law__chip--topic">
                  {humanizeLegalTopic(topic)}
                </span>
              ))}
              {item.hasExplainer ? (
                <span className="ds-law__browse-note">Plain-language explainer</span>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

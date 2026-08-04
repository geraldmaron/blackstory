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
  /** Plain-language opening line, so the card says what the law does. */
  readonly summary?: string;
  readonly effectiveYear?: number;
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
          {/*
           * The whole card is the hit target: the title link stretches over the card via
           * ::after, so the surrounding text stays selectable and there is still exactly
           * one link per card for screen readers and tab order.
           */}
          <article className="ds-law__card">
            {/*
             * The year is real content when present, so it stays in the accessibility tree.
             * The em-dash placeholder is decorative and would just read as punctuation.
             */}
            {item.effectiveYear ? (
              <p className="ds-law__card-year">
                <span className="ds-visually-hidden">Took effect </span>
                {item.effectiveYear}
              </p>
            ) : (
              <p className="ds-law__card-year" aria-hidden="true">
                —
              </p>
            )}

            <div className="ds-law__card-body">
              <div className="ds-law__card-head">
                <h3 className="ds-law__browse-title">
                  <Link className="ds-law__card-link" href={`/law/${item.slug}`}>
                    {item.title}
                  </Link>
                </h3>
                <LegalStatusBadge status={item.lawStatus} />
              </div>

              {item.summary ? <p className="ds-law__card-summary">{item.summary}</p> : null}

              <p className="ds-law__browse-citation">{item.citation}</p>

              <div className="ds-law__browse-meta">
                <span className="ds-law__chip ds-law__chip--kind">
                  {humanizeLegalKind(item.kind)}
                </span>
                {item.topics.map((topic) => (
                  <span key={topic} className="ds-law__chip ds-law__chip--topic">
                    {humanizeLegalTopic(topic)}
                  </span>
                ))}
                {item.hasExplainer ? null : (
                  <span className="ds-law__browse-note">Explainer in review</span>
                )}
              </div>
            </div>

            <span className="ds-law__card-cue" aria-hidden="true">
              →
            </span>
          </article>
        </li>
      ))}
    </ul>
  );
}

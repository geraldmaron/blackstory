/**
 * “Did you know” panel for `/history`: short archival framings with SourceFootnote
 * citations. Never presents unsourced trivia; each fact carries named archive URLs.
 */
import React from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';
import { SourceFootnote } from '../data/SourceFootnote';
import { selectDidYouKnowFacts, type HistoryDidYouKnowFact } from '../../lib/history/did-you-know';

void React;

export type HistoryDidYouKnowProps = {
  readonly seed?: number;
  readonly count?: number;
  readonly facts?: readonly HistoryDidYouKnowFact[];
  readonly className?: string;
};

export function HistoryDidYouKnow({
  seed = 1,
  count = 3,
  facts,
  className,
}: HistoryDidYouKnowProps) {
  const selected = facts ?? selectDidYouKnowFacts(count, seed);

  if (selected.length === 0) return null;

  return (
    <section className={cx('ds-history-dyk', className)} aria-labelledby="history-dyk-heading">
      <h3 className="ds-section__kicker" id="history-dyk-heading">
        From the archive
      </h3>
      <p className="ds-mono ds-history-dyk__lede">
        Evidence-backed framings — obscure where the record allows, never spectacle.
      </p>
      <ul className="ds-history-dyk__list">
        {selected.map((fact) => (
          <li key={fact.id} className="ds-history-dyk__item">
            <p className="ds-serif ds-history-dyk__statement">{fact.statement}</p>
            {fact.relatedEntityId ? (
              <p className="ds-history-dyk__related">
                <Link className="ds-cta ds-cta--quiet" href={`/entity/${fact.relatedEntityId}`}>
                  Open related record
                </Link>
              </p>
            ) : null}
            <SourceFootnote sources={fact.sources} density="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}

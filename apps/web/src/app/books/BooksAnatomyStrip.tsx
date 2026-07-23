/**
 * Compact challenged-title fact strip for detail intro panels. EditionFactIcon labels
 * pair with visible text so icons are never the only signal (WCAG 1.4.1).
 */
import React from 'react';
import Link from 'next/link';
import { EditionFactIcon } from '../../components/patterns/EditionFactIcon';
import '../../components/patterns/edition-fact-icon.css';

void React;

export type BooksAnatomyStripProps = {
  readonly authorLine: string;
  readonly publishedDate: string;
  readonly citationCount: number;
  readonly challengeCount: number;
  readonly stateCount: number;
  readonly isbn?: string;
};

export function BooksAnatomyStrip({
  authorLine,
  publishedDate,
  citationCount,
  challengeCount,
  stateCount,
  isbn,
}: BooksAnatomyStripProps) {
  return (
    <section className="ds-books-anatomy" aria-label="Title at a glance">
      <dl className="ds-books-anatomy__facts">
        <div className="ds-books-anatomy__fact">
          <dt className="ds-books-anatomy__fact-label">
            <EditionFactIcon variant="entry" step="source" />
            Author
          </dt>
          <dd className="ds-books-anatomy__fact-value">{authorLine}</dd>
        </div>
        <div className="ds-books-anatomy__fact">
          <dt className="ds-books-anatomy__fact-label">
            <EditionFactIcon variant="record-era" />
            Published
          </dt>
          <dd className="ds-books-anatomy__fact-value">{publishedDate}</dd>
        </div>
        <div className="ds-books-anatomy__fact">
          <dt className="ds-books-anatomy__fact-label">
            <EditionFactIcon variant="record-evidence" tier="high" />
            Citations
          </dt>
          <dd className="ds-books-anatomy__fact-value">
            <Link className="ds-books-anatomy__fact-link" href="#citations">
              {citationCount} source{citationCount === 1 ? '' : 's'}
            </Link>
          </dd>
        </div>
        <div className="ds-books-anatomy__fact">
          <dt className="ds-books-anatomy__fact-label">
            <EditionFactIcon variant="record-where" />
            Challenges
          </dt>
          <dd className="ds-books-anatomy__fact-value">
            <Link className="ds-books-anatomy__fact-link" href="#challenges">
              {challengeCount} report{challengeCount === 1 ? '' : 's'}
              {stateCount > 0 ? ` · ${stateCount} state${stateCount === 1 ? '' : 's'}` : ''}
            </Link>
          </dd>
        </div>
        {isbn ? (
          <div className="ds-books-anatomy__fact ds-books-anatomy__fact--wide">
            <dt className="ds-books-anatomy__fact-label">
              <EditionFactIcon variant="entry" step="source" />
              ISBN
            </dt>
            <dd className="ds-books-anatomy__fact-value">
              <span className="ds-mono">{isbn}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

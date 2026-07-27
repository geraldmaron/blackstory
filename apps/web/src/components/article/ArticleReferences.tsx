/**
 * Numbered references section for an article. Each entry is a link target
 * (`#ref-<n>`) that inline citation superscripts point at.
 */
import React from 'react';
import type { ArticleReferenceEntry } from '../../lib/articles/hydrate';

void React;

export type ArticleReferencesProps = {
  readonly references: readonly ArticleReferenceEntry[];
  readonly headingId?: string;
};

export function ArticleReferences({ references, headingId }: ArticleReferencesProps) {
  if (references.length === 0) return null;
  return (
    <ol className="ds-article-references" aria-labelledby={headingId}>
      {references.map((ref) => (
        <li key={ref.number} id={`ref-${ref.number}`} className="ds-article-references__item">
          <span className="ds-article-references__num" aria-hidden="true">
            {ref.number}.
          </span>
          <span className="ds-article-references__body">
            <a href={ref.url} rel="noreferrer noopener" target="_blank">
              {ref.label}
            </a>
            {ref.locator ? (
              <span className="ds-article-references__locator"> · {ref.locator}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

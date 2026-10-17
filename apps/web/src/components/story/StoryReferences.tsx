/**
 * Numbered references section for a story. Each entry is a link target
 * (`#ref-<n>`) that inline citation superscripts point at.
 */
import React from 'react';
import type { StoryReferenceEntry } from '../../lib/stories/hydrate';

void React;

export type StoryReferencesProps = {
  readonly references: readonly StoryReferenceEntry[];
  readonly headingId?: string;
};

export function StoryReferences({ references, headingId }: StoryReferencesProps) {
  if (references.length === 0) return null;
  return (
    <ol className="ds-reading-references" aria-labelledby={headingId}>
      {references.map((ref) => (
        <li key={ref.number} id={`ref-${ref.number}`} className="ds-reading-references__item">
          <span className="ds-reading-references__num" aria-hidden="true">
            {ref.number}.
          </span>
          <span className="ds-reading-references__body">
            <a href={ref.url} rel="noreferrer noopener" target="_blank">
              {ref.label}
            </a>
            {ref.locator ? (
              <span className="ds-reading-references__locator"> · {ref.locator}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

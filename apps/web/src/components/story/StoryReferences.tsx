/**
 * A story's sources: a plain numbered list on the reading measure. Each entry is the link target
 * (`#ref-<n>`) the inline citation numbers point at.
 */
import React from 'react';
import type { StoryReferenceEntry } from '../../lib/stories/hydrate';

void React;

export type StoryReferencesProps = {
  readonly references: readonly StoryReferenceEntry[];
  /** Id of the heading that names the list. */
  readonly headingId?: string;
};

export function StoryReferences({ references, headingId }: StoryReferencesProps) {
  if (references.length === 0) return null;
  return (
    <ol className="ds-story-sources" aria-labelledby={headingId}>
      {references.map((ref) => (
        <li key={ref.number} id={`ref-${ref.number}`} className="ds-story-sources__item">
          <span className="ds-story-sources__num" aria-hidden="true">
            {ref.number}
          </span>
          <span className="ds-story-sources__body">
            <a href={ref.url} rel="noreferrer noopener" target="_blank">
              {ref.label}
            </a>
            {ref.locator ? (
              <span className="ds-story-sources__locator">, {ref.locator}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

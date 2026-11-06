/**
 * "In this chapter": the section list for a story, rendered in one of two placements from the
 * same headings so the two can never disagree about a target.
 *
 *  - `rail`: the sticky desktop rail group (markup unchanged from before this component existed).
 *  - `inline`: a native details/summary above the prose, for widths where the rail has stacked
 *    under the column and would be read after the whole chapter.
 *
 * Both are always in the document; story.css shows exactly one per viewport at the room's 68rem
 * rail breakpoint, using display:none so assistive tech never reads both. Their DOM ids differ
 * (`story-toc` vs `story-toc-inline`). A chapter with no h2 headings renders neither.
 */
import React from 'react';
import type { ChapterHeading } from '../../lib/stories/heading-anchors';

void React;

export type StoryContentsProps = {
  readonly headings: readonly ChapterHeading[];
  /** `chapter` or `entry`, the word the page uses for itself. */
  readonly noun: string;
  readonly variant: 'rail' | 'inline';
};

export function StoryContents({ headings, noun, variant }: StoryContentsProps) {
  if (headings.length === 0) return null;
  const title = `In this ${noun}`;

  if (variant === 'rail') {
    return (
      <nav className="ds-room-rail-group ds-reading-toc-rail" aria-labelledby="story-toc">
        <p className="ds-room-rail-group__title" id="story-toc">
          {title}
        </p>
        <ul className="ds-room-rail-group__list">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a className="ds-room-rail-group__link" href={`#${heading.id}`}>
                <span className="ds-room-rail-group__label">{heading.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <details className="ds-reading-toc" id="story-toc-inline">
      <summary className="ds-reading-toc__summary">
        <span className="ds-reading-toc__title">{title}</span>
        <span className="ds-reading-toc__count ds-mono">
          {headings.length} {headings.length === 1 ? 'section' : 'sections'}
        </span>
        <span className="ds-reading-toc__cue" aria-hidden="true" />
      </summary>
      <nav aria-label={title}>
        <ul className="ds-reading-toc__list">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a className="ds-reading-toc__link" href={`#${heading.id}`}>
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

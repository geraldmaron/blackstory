/**
 * Vertical timeline for chronological claim and event narratives.
 */

import React, { type ReactNode } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import { cx } from '../utils/cx.js';
import { headingTag, type HeadingLevel } from '../utils/heading.js';

export type TimelineItem = {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly body?: ReactNode;
};

export type TimelineProps = {
  readonly items: readonly TimelineItem[];
  readonly className?: string;
  readonly labelledBy?: string;
  /** Renders each item title as a heading at this level. Defaults to h3. */
  readonly headingLevel?: HeadingLevel;
};

export function Timeline({ items, className, labelledBy, headingLevel = 3 }: TimelineProps) {
  const Heading = headingTag(headingLevel);

  return (
    <ol className={cx('ds-timeline', className)} aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="ds-timeline__item">
          <span className="ds-timeline__marker" aria-hidden="true" />
          <time className="ds-timeline__time" dateTime={item.time}>
            {item.time}
          </time>
          <Heading className="ds-timeline__title">{item.title}</Heading>
          {item.body ? <div className="ds-timeline__body">{item.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}

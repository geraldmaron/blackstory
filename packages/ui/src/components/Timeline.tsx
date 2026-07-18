
/**
 * Vertical timeline for chronological claim and event narratives.
 */

import React, { type  ReactNode  } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import { cx } from '../utils/cx.js';

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
};

export function Timeline({ items, className, labelledBy }: TimelineProps) {
  return (
    <ol className={cx('bp-timeline', className)} aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="bp-timeline__item">
          <span className="bp-timeline__marker" aria-hidden="true" />
          <time className="bp-timeline__time" dateTime={item.time}>
            {item.time}
          </time>
          <h3 className="bp-timeline__title">{item.title}</h3>
          {item.body ? <div className="bp-timeline__body">{item.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}

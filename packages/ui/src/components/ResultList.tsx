
/**
 * Search/result list with title, summary, and optional meta row.
 */

import React, { type  ReactNode  } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import { cx } from '../utils/cx.js';

export type ResultItem = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly meta?: ReactNode;
};

export type ResultListProps = {
  readonly items: readonly ResultItem[];
  readonly className?: string;
  readonly labelledBy?: string;
};

export function ResultList({ items, className, labelledBy }: ResultListProps) {
  return (
    <ul className={cx('bp-result-list', className)} aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="bp-result-list__item">
          <a className="bp-result-list__link" href={item.href}>
            <h3 className="bp-result-list__title">{item.title}</h3>
            <p className="bp-result-list__summary">{item.summary}</p>
            {item.meta ? <div className="bp-result-list__meta">{item.meta}</div> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
